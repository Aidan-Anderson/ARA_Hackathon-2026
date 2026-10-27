import { crossSection } from '../model/geometry'
import type { Axis, Level, Project, ShearLine } from '../model/project'
import {
  LOAD_CASES,
  type CaseResult,
  type LevelResult,
  type LineResult,
  type LoadCaseId,
  type Results,
} from '../model/results'
import { areaLoad, diaphragmReactions, diaphragmSpans, type DiaphragmSpans } from './diaphragm'
import { levelForces, type LevelForces } from './forces'
import { depthPieces } from './sections'

const SEISMIC_CASES: LoadCaseId[] = ['SX', 'SY']

/**
 * The engine's only entry point (docs/spec.md §4.1, §5).
 * So far: seismic F_x and F_px runs on each Level. Story shear, Openings, Collectors, and wind
 * arrive in later tickets.
 */
export function analyze(project: Project): Results {
  const forces = levelForces(project)
  const cases = {} as Record<LoadCaseId, CaseResult>
  for (const loadCase of LOAD_CASES) {
    const seismic = SEISMIC_CASES.includes(loadCase.id)
    cases[loadCase.id] = {
      caseId: loadCase.id,
      direction: loadCase.direction,
      asdFactor: loadCase.asdFactor,
      levels: project.levels.map((level, i) =>
        seismic ? analyzeSeismicLevel(level, loadCase.direction, forces[i]) : emptyLevel(level),
      ),
    }
  }
  return { cases, envelope: [], warnings: [] }
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
  const lines = level.shearLines
    .filter((line) => line.direction === direction)
    .sort((a, b) => a.position - b.position)
  if (lines.length < 2 || forces.netArea <= 0) return result

  const depth = depthPieces(level.outline, direction)
  const reactionsFx = diaphragmReactions(lines, areaLoad(depth, forces.fx / forces.netArea))
  const fpxRun = diaphragmSpans(lines, areaLoad(depth, forces.fpx.design / forces.netArea), { gross: depth, net: depth })

  result.spans = fpxRun.spans
  result.lines = lines.map((line, i) => lineResult(line, level, i, reactionsFx[i], fpxRun))
  return result
}

function lineResult(line: ShearLine, level: Level, i: number, reactionFx: number, fpxRun: DiaphragmSpans): LineResult {
  const section = crossSection(level.outline, line.direction, line.position)
  return {
    lineId: line.id,
    length: section ? section[1] - section[0] : 0,
    reactionFx,
    reactionFpx: fpxRun.reactions[i],
    storyShear: reactionFx, // A4.1 accumulates Levels above
    unitShearLeft: fpxRun.unitShearLeft[i],
    unitShearRight: fpxRun.unitShearRight[i],
    elements: [], // A3.1
    collector: { force: { s: [], v: [] }, maxForce: 0 }, // A3.1
    continuesBelow: true, // A4.1
  }
}

function emptyLevel(level: Level): LevelResult {
  return { levelId: level.id, netArea: 0, fx: 0, weight: 0, spans: [], lines: [], corners: [], transfersIn: [] }
}
