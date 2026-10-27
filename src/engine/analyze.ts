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
import { simpleBeam, type BeamLoads } from './beam'
import { depthPieces, outlineArea } from './sections'

const SEISMIC_CASES: LoadCaseId[] = ['SX', 'SY']

/**
 * The engine's only entry point (docs/spec.md §4.1, §5).
 * A1.1: seismic F_x run on each Level independently. Story shear, F_px, diagrams,
 * Collectors, and wind arrive in later tickets.
 */
export function analyze(project: Project): Results {
  const cases = {} as Record<LoadCaseId, CaseResult>
  for (const loadCase of LOAD_CASES) {
    const seismic = SEISMIC_CASES.includes(loadCase.id)
    cases[loadCase.id] = {
      caseId: loadCase.id,
      direction: loadCase.direction,
      asdFactor: loadCase.asdFactor,
      levels: project.levels.map((level) =>
        seismic ? analyzeSeismicLevel(level, loadCase.direction) : emptyLevel(level),
      ),
    }
  }
  return { cases, envelope: [], warnings: [] }
}

function analyzeSeismicLevel(level: Level, direction: Axis): LevelResult {
  const netArea = outlineArea(level.outline)
  const q = level.seismic.fxPsf / 1000 // ksf
  const loads: BeamLoads = {
    uniform: depthPieces(level.outline, direction).map((piece) => ({ from: piece.from, to: piece.to, w: q * piece.depth })),
    points: [],
  }
  const lines = level.shearLines
    .filter((line) => line.direction === direction)
    .sort((a, b) => a.position - b.position)
  const reactions = diaphragmReactions(lines, loads)

  return {
    levelId: level.id,
    netArea,
    fx: q * netArea,
    weight: (level.seismic.weightPsf / 1000) * netArea,
    spans: [],
    lines: lines.length < 2 ? [] : lines.map((line, i) => lineResult(line, level, reactions[i])),
    corners: [],
    transfersIn: [],
  }
}

/** Diaphragm Reaction on each line (sorted by position): the end reactions of the spans on either side. */
function diaphragmReactions(lines: ShearLine[], loads: BeamLoads): number[] {
  const reactions = lines.map(() => 0)
  for (let j = 0; j + 1 < lines.length; j++) {
    const start = lines[j].position
    const end = lines[j + 1].position
    if (end - start <= 1e-9) continue // two lines at one position: no span between them
    const span = simpleBeam(start, end, loads)
    reactions[j] += span.rStart
    reactions[j + 1] += span.rEnd
  }
  return reactions
}

function lineResult(line: ShearLine, level: Level, reactionFx: number): LineResult {
  const section = crossSection(level.outline, line.direction, line.position)
  return {
    lineId: line.id,
    length: section ? section[1] - section[0] : 0,
    reactionFx,
    reactionFpx: 0, // A2.1
    storyShear: reactionFx, // A4.1 accumulates Levels above
    unitShearLeft: 0, // A2.1
    unitShearRight: 0, // A2.1
    elements: [], // A3.1
    collector: { force: { s: [], v: [] }, maxForce: 0 }, // A3.1
    continuesBelow: true, // A4.1
  }
}

function emptyLevel(level: Level): LevelResult {
  return { levelId: level.id, netArea: 0, fx: 0, weight: 0, spans: [], lines: [], corners: [], transfersIn: [] }
}
