// UI state shared by both tracks (docs/spec.md §4.2). Announce changes in the commit message.

import type { Dispatch, SetStateAction } from 'react'
import type { Level, Project } from './project'
import type { LoadCaseId, Results } from './results'

export type Selection =
  /** Shows the line and its Collector. */
  | { kind: 'shearLine'; levelId: string; id: string }
  | { kind: 'lateralElement'; levelId: string; lineId: string; id: string }
  | { kind: 'opening'; levelId: string; id: string }
  /** levelId = the Level that receives the Transfer Force. */
  | { kind: 'transfer'; levelId: string; fromLineId: string }
  | null

/** A Load Case, or the Envelope. */
export type CaseView = LoadCaseId | 'ENV'

/** Everything App.tsx passes to each component. */
export interface AppViewProps {
  project: Project
  setProject: Dispatch<SetStateAction<Project>>
  results: Results
  levelId: string
  setLevelId: Dispatch<SetStateAction<string>>
  caseId: CaseView
  setCaseId: Dispatch<SetStateAction<CaseView>>
  /** Strength/ASD toggle for plan labels. */
  showAsd: boolean
  setShowAsd: Dispatch<SetStateAction<boolean>>
  selection: Selection
  setSelection: Dispatch<SetStateAction<Selection>>
}

/** The Level shown on the plan. Falls back to the top Level if levelId is stale (e.g. after a delete or load). */
export function currentLevel(project: Project, levelId: string): Level {
  return project.levels.find((level) => level.id === levelId) ?? project.levels[project.levels.length - 1]
}
