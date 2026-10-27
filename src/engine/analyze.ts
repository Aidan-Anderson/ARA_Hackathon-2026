import { shearLineExtent } from '../model/geometry'
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
  stripLineLoad,
  totalLoad,
} from './diaphragm'
import { envelope } from './envelope'
import { levelForces, type LevelForces } from './forces'
import { continuation, fromAbove, NOTHING_FROM_ABOVE, transferResult, type FromAbove } from './levels'
import {
  IRREGULARITY_COLLECTOR_FACTOR,
  irregularityApplies,
  reentrantIrregularity,
} from './seismicCode'
import { cutAt, extentOf, levelSections, reentrantVertices, totalLength } from './sections'
import { diaphragmBands, supportsBand, transferShares } from './bands'
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

/** What one Shear Line collects, summed over the strips it supports. */
interface LineTotals {
  reactionFx: number
  reactionFpx: number
  shearLeft: number
  shearRight: number
  /** Only used with a single strip, where they are exact per side. */
  unitShearLeft: number
  unitShearRight: number
}

/**
 * One Level in one Load Case. windPlf is null for seismic; wind has one run, used as both F_x and F_px.
 * Transfer Forces from above go into both runs as point loads (spec §5.10). Shortened Shear Lines
 * split the Diaphragm into strips, each a simple beam between the lines covering it (ADR 0002).
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
  const windW = windPlf === null ? null : windPlf / 1000
  const wind = windW === null ? null : lineLoad(sections.gross, windW)

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

  const bands = diaphragmBands(level, direction, lines)
  const banded = bands.length > 1
  const totals = new Map<string, LineTotals>(
    lines.map((line) => [line.id, { reactionFx: 0, reactionFpx: 0, shearLeft: 0, shearRight: 0, unitShearLeft: 0, unitShearRight: 0 }]),
  )
  const shares = incoming.transfers.map((t) => transferShares(shearLineExtent(level.outline, t.line), bands))

  bands.forEach((band, b) => {
    const bandSections = banded ? levelSections(level, direction, band) : sections
    const bandExtent = extentOf(bandSections.gross)
    const supporting = lines.filter((line) => supportsBand(level, line, band))
    if (!bandExtent || supporting.length === 0) return // validate reports unsupported strips

    const points = incoming.transfers
      .map((t, k) => ({ at: t.line.position, p: t.force * shares[k][b] }))
      .filter((point) => point.p !== 0)
    const withTransfers = (loads: BeamLoads): BeamLoads => ({ uniform: loads.uniform, points: [...loads.points, ...points] })
    const bandWind = windW === null ? null : banded ? stripLineLoad(sections.gross, bandSections.gross, windW) : wind
    const fpxRun = diaphragmSpans(
      supporting,
      withTransfers(bandWind ?? areaLoad(bandSections.net, forces.fpx.design / forces.netArea)),
      bandSections,
      bandExtent,
      reentrantVertices(level.outline, direction, bandSections.gross),
    )
    const reactionsFx = bandWind
      ? fpxRun.reactions
      : diaphragmReactions(supporting, withTransfers(areaLoad(bandSections.net, forces.fx / forces.netArea)), bandExtent)

    supporting.forEach((line, i) => {
      const t = totals.get(line.id)!
      t.reactionFx += reactionsFx[i]
      t.reactionFpx += fpxRun.reactions[i]
      t.shearLeft += fpxRun.shearLeft[i]
      t.shearRight += fpxRun.shearRight[i]
      t.unitShearLeft += fpxRun.unitShearLeft[i]
      t.unitShearRight += fpxRun.unitShearRight[i]
    })
    result.spans.push(...(banded ? fpxRun.spans.map((span) => ({ ...span, band: { from: band[0], to: band[1] } })) : fpxRun.spans))
    result.corners.push(...fpxRun.corners)
  })

  result.transfersIn = incoming.transfers.map((transfer) => transferResult(level, direction, transfer))
  result.lines = lines.map((line) =>
    lineResult(line, level, totals.get(line.id)!, banded, incoming.shear.get(line.id) ?? 0, below),
  )
  return result
}

function lineResult(
  line: ShearLine,
  level: Level,
  totals: LineTotals,
  banded: boolean,
  shearFromAbove: number,
  below: Level | null,
): LineResult {
  // Along the line's own extent: the full cross-section unless it has been shortened.
  const cut = cutAt(level, line.direction, line.position, shearLineExtent(level.outline, line) ?? undefined)
  const netLength = cut ? totalLength(cut.net) : 0
  const plf = (shear: number) => (netLength > 0 ? (shear / netLength) * 1000 : 0)
  const storyShear = totals.reactionFx + shearFromAbove
  return {
    lineId: line.id,
    length: cut ? cut.section[1] - cut.section[0] : 0,
    reactionFx: totals.reactionFx,
    reactionFpx: totals.reactionFpx,
    storyShear,
    unitShearLeft: banded ? plf(totals.shearLeft) : totals.unitShearLeft,
    unitShearRight: banded ? plf(totals.shearRight) : totals.unitShearRight,
    elements: cut ? elementDemands(line, cut.section, storyShear) : [],
    collector: cut ? lineCollector(line, cut, totals.reactionFpx) : { force: { s: [], v: [] }, maxForce: 0 },
    // The bottom Level's lines go to the foundation.
    continuesBelow: !below || continuation(line, below) !== undefined,
  }
}

function emptyLevel(level: Level): LevelResult {
  return { levelId: level.id, netArea: 0, fx: 0, weight: 0, spans: [], lines: [], corners: [], transfersIn: [] }
}
