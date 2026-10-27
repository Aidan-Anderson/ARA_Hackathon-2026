import type { Project } from '../model/project'
import { LOAD_CASES, type CaseResult, type LoadCaseId, type Results } from '../model/results'

/**
 * The engine's only entry point (docs/spec.md §4.1, §5).
 * P0.2 stub: valid, all-zero Results so the UI compiles. Track A fills it in from A1.1 on.
 */
export function analyze(project: Project): Results {
  const cases = {} as Record<LoadCaseId, CaseResult>
  for (const loadCase of LOAD_CASES) {
    cases[loadCase.id] = {
      caseId: loadCase.id,
      direction: loadCase.direction,
      asdFactor: loadCase.asdFactor,
      levels: project.levels.map((level) => ({
        levelId: level.id,
        netArea: 0,
        fx: 0,
        weight: 0,
        spans: [],
        lines: [],
        corners: [],
        transfersIn: [],
      })),
    }
  }
  return { cases, envelope: [], warnings: [] }
}
