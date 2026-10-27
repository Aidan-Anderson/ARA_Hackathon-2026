import type { Axis, Level, Project, ShearLine } from '../model/project'
import {
  LOAD_CASES,
  type CaseResult,
  type LevelResult,
  type LineResult,
  type LoadCaseId,
  type Results,
  type Warning,
} from '../model/results'
import { elementDemands, lineCollector } from './collectors'
import {
  areaLoad,
  diaphragmReactions,
  diaphragmSpans,
  lineLoad,
  shearLinesIn,
  totalLoad,
  type DiaphragmSpans,
} from './diaphragm'
import { envelope } from './envelope'
import { levelForces, type LevelForces } from './forces'
import { continuation, fromAbove, NOTHING_FROM_ABOVE, transferResult, type FromAbove } from './levels'
import {
  IRREGULARITY_COLLECTOR_FACTOR,
  irregularityApplies,
  reentrantIrregularity,
} from './seismicCode'
import { cutAt, extentOf, levelSections, reentrantVertices } from './sections'
import { levelWarnings, transferWarnings } from './validate'
import type { BeamLoads } from './beam'

const SEISMIC_CASES: LoadCaseId[] = ['SX', 'SY']

/**
 * The engine's only entry point (docs/spec.md §4.1, §5): seismic and wind on every Level, with
 * L/T shapes, Openings, Overhangs, Re-entrant Corners, Lateral Elements, Collectors, story shear
 * down the building, Transfer Forces, the Envelope, and validation.
 */
export function analyze(project: Project): Results {
  const warnings = project.levels.flatMap(levelWarnings)
  const invalid = new Set(warnings.filter((w) => w.code === 'outline-invalid').map((w) => w.levelId))
  warnings.push(...transferWarnings(project, invalid))
  const forces = levelForces(project)

  const cases = {} as Record<LoadCaseId, CaseResult>
  for (const loadCase of LOAD_CASES) {
    const windPlf = SEISMIC_CASES.includes(loadCase.id) ? null : project.loads.windPlf[loadCase.direction]
    cases[loadCase.id] = {
      caseId: loadCase.id,
      direction: loadCase.direction,
      asdFactor: loadCase.asdFactor,
      levels: analyzeStack(project, loadCase.direction, forces, windPlf, invalid),
    }
  }
  warnings.push(...applyReentrantIrregularity(project, cases, invalid))
  return { cases, envelope: envelope(cases), warnings }
}

/**
 * §12.3.3.4 (spec §5.14): in SDC D–F, a Level with a re-entrant corner irregularity gets its seismic
 * Collector and transfer Collector Demands increased by 25%.
 */
function applyReentrantIrregularity(
  project: Project,
  cases: Record<LoadCaseId, CaseResult>,
  invalid: Set<string | undefined>,
): Warning[] {
  const sdc = project.loads.seismicCode?.sdc
  if (!irregularityApplies(sdc)) return []
  const factor = IRREGULARITY_COLLECTOR_FACTOR
  const amplify = (collector: { force: { s: number[]; v: number[] }; maxForce: number }) => ({
    force: { s: collector.force.s, v: collector.force.v.map((v) => v * factor) },
    maxForce: collector.maxForce * factor,
  })

  const warnings: Warning[] = []
  project.levels.forEach((level, i) => {
    if (invalid.has(level.id) || !reentrantIrregularity(level.outline)) return
    for (const caseId of SEISMIC_CASES) {
      const result = cases[caseId].levels[i]
      result.lines = result.lines.map((line) => ({ ...line, collector: amplify(line.collector) }))
      result.transfersIn = result.transfersIn.map((t) => ({
        ...t,
        collectorPlf: t.collectorPlf * factor,
        collector: amplify(t.collector),
      }))
    }
    warnings.push({
      severity: 'warning',
      code: 'reentrant-irregularity',
      levelId: level.id,
      message: `${level.name}: re-entrant corner irregularity (ASCE 7 §12.3.3.4, SDC ${sdc}), so seismic Collector Demands are increased by 25%.`,
    })
  })
  return warnings
}

/**
 * Every Level for one Load Case, top to bottom, so story shear and Transfer Forces flow down.
 * A Level with an invalid outline breaks the chain: nothing flows into or through it.
 */
function analyzeStack(
  project: Project,
  direction: Axis,
  forces: LevelForces[],
  windPlf: number | null,
  invalid: Set<string | undefined>,
): LevelResult[] {
  const results: LevelResult[] = []
  let incoming = NOTHING_FROM_ABOVE
  for (let i = project.levels.length - 1; i >= 0; i--) {
    const level = project.levels[i]
    if (invalid.has(level.id)) {
      results[i] = emptyLevel(level)
      incoming = NOTHING_FROM_ABOVE
      continue
    }
    const below = i > 0 && !invalid.has(project.levels[i - 1].id) ? project.levels[i - 1] : null
    results[i] = analyzeLevel(level, direction, forces[i], windPlf, incoming, below)
    incoming = below ? fromAbove(level, results[i], below, direction) : NOTHING_FROM_ABOVE
  }
  return results
}

/**
 * One Level in one Load Case. windPlf is null for seismic; wind has one run, used as both F_x and F_px.
 * Transfer Forces from above go into both runs as point loads (spec §5.10).
 */
function analyzeLevel(
  level: Level,
  direction: Axis,
  forces: LevelForces,
  windPlf: number | null,
  incoming: FromAbove,
  below: Level | null,
): LevelResult {
  const sections = levelSections(level, direction)
  const extent = extentOf(sections.gross)
  const wind = windPlf === null ? null : lineLoad(sections.gross, windPlf / 1000)

  const result: LevelResult = {
    levelId: level.id,
    netArea: forces.netArea,
    fx: wind ? totalLoad(wind) : forces.fx,
    weight: wind ? 0 : forces.weight,
    spans: [],
    lines: [],
    corners: [],
    transfersIn: [],
  }
  if (!wind) result.fpx = forces.fpx

  const lines = shearLinesIn(level, direction)
  if (lines.length < 2 || !extent || forces.netArea <= 0) return result

  const transfers = incoming.transfers.map((t) => ({ at: t.line.position, p: t.force }))
  const withTransfers = (loads: BeamLoads): BeamLoads => ({ uniform: loads.uniform, points: [...loads.points, ...transfers] })
  const fpxLoads = withTransfers(wind ?? areaLoad(sections.net, forces.fpx.design / forces.netArea))
  const fpxRun = diaphragmSpans(lines, fpxLoads, sections, extent, reentrantVertices(level.outline, direction, sections.gross))
  const reactionsFx = wind
    ? fpxRun.reactions
    : diaphragmReactions(lines, withTransfers(areaLoad(sections.net, forces.fx / forces.netArea)), extent)

  result.spans = fpxRun.spans
  result.corners = fpxRun.corners
  result.transfersIn = incoming.transfers.map((transfer) => transferResult(level, direction, transfer))
  result.lines = lines.map((line, i) =>
    lineResult(line, level, reactionsFx[i], fpxRun, i, incoming.shear.get(line.id) ?? 0, below),
  )
  return result
}

function lineResult(
  line: ShearLine,
  level: Level,
  reactionFx: number,
  fpxRun: DiaphragmSpans,
  i: number,
  shearFromAbove: number,
  below: Level | null,
): LineResult {
  const cut = cutAt(level, line.direction, line.position)
  const storyShear = reactionFx + shearFromAbove
  return {
    lineId: line.id,
    length: cut ? cut.section[1] - cut.section[0] : 0,
    reactionFx,
    reactionFpx: fpxRun.reactions[i],
    storyShear,
    unitShearLeft: fpxRun.unitShearLeft[i],
    unitShearRight: fpxRun.unitShearRight[i],
    elements: cut ? elementDemands(line, cut.section, storyShear) : [],
    collector: cut ? lineCollector(line, cut, fpxRun.reactions[i]) : { force: { s: [], v: [] }, maxForce: 0 },
    // The bottom Level's lines go to the foundation.
    continuesBelow: !below || continuation(line, below) !== undefined,
  }
}

function emptyLevel(level: Level): LevelResult {
  return { levelId: level.id, netArea: 0, fx: 0, weight: 0, spans: [], lines: [], corners: [], transfersIn: [] }
}
