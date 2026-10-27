import type { Axis, Level, Project, ShearLine } from '../model/project'
import {
  LOAD_CASES,
  type CaseResult,
  type LevelResult,
  type LineResult,
  type LoadCaseId,
  type Results,
} from '../model/results'
import { elementDemands, lineCollector } from './collectors'
import { areaLoad, diaphragmReactions, diaphragmSpans, shearLinesIn, type DiaphragmSpans } from './diaphragm'
import { levelForces, type LevelForces } from './forces'
import { cutAt, extentOf, levelSections, reentrantVertices } from './sections'
import { levelWarnings } from './validate'

const SEISMIC_CASES: LoadCaseId[] = ['SX', 'SY']

/**
 * The engine's only entry point (docs/spec.md §4.1, §5).
 * So far: seismic F_x and F_px runs on each Level, with L/T shapes, Openings, Overhangs,
 * Re-entrant Corners, Lateral Elements, Collectors, and validation. Story shear across Levels
 * and wind arrive in later tickets.
 */
export function analyze(project: Project): Results {
  const warnings = project.levels.flatMap(levelWarnings)
  const invalid = new Set(warnings.filter((w) => w.code === 'outline-invalid').map((w) => w.levelId))
  const forces = levelForces(project)

  const cases = {} as Record<LoadCaseId, CaseResult>
  for (const loadCase of LOAD_CASES) {
    const seismic = SEISMIC_CASES.includes(loadCase.id)
    cases[loadCase.id] = {
      caseId: loadCase.id,
      direction: loadCase.direction,
      asdFactor: loadCase.asdFactor,
      levels: project.levels.map((level, i) =>
        seismic && !invalid.has(level.id) ? analyzeSeismicLevel(level, loadCase.direction, forces[i]) : emptyLevel(level),
      ),
    }
  }
  return { cases, envelope: [], warnings }
}

function analyzeSeismicLevel(level: Level, direction: Axis, forces: LevelForces): LevelResult {
  const result: LevelResult = {
    levelId: level.id,
    netArea: forces.netArea,
    fx: forces.fx,
    weight: forces.weight,
    fpx: forces.fpx,
    spans: [],
    lines: [],
    corners: [],
    transfersIn: [],
  }
  const lines = shearLinesIn(level, direction)
  const sections = levelSections(level, direction)
  const extent = extentOf(sections.gross)
  if (lines.length < 2 || !extent || forces.netArea <= 0) return result

  const reactionsFx = diaphragmReactions(lines, areaLoad(sections.net, forces.fx / forces.netArea), extent)
  const fpxRun = diaphragmSpans(
    lines,
    areaLoad(sections.net, forces.fpx.design / forces.netArea),
    sections,
    extent,
    reentrantVertices(level.outline, direction, sections.gross),
  )

  result.spans = fpxRun.spans
  result.corners = fpxRun.corners
  result.lines = lines.map((line, i) => lineResult(line, level, i, reactionsFx[i], fpxRun))
  return result
}

function lineResult(line: ShearLine, level: Level, i: number, reactionFx: number, fpxRun: DiaphragmSpans): LineResult {
  const cut = cutAt(level, line.direction, line.position)
  const storyShear = reactionFx // A4.1 accumulates Levels above
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
    continuesBelow: true, // A4.1
  }
}

function emptyLevel(level: Level): LevelResult {
  return { levelId: level.id, netArea: 0, fx: 0, weight: 0, spans: [], lines: [], corners: [], transfersIn: [] }
}
