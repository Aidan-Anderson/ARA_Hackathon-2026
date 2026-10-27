// UI state shared by both tracks (docs/spec.md §4.2). Announce changes in the commit message.

import type { Dispatch, SetStateAction } from 'react'
import type { Axis, LateralElement, Level, Project } from './project'
import type { LoadCaseId, Results } from './results'

/** How the plan is built (spec §6.2): on the Grid, by drawing, or by tracing an imported Underlay. */
export type EditorMode = 'grid' | 'draw' | 'import'

export type EditorTool = 'select' | 'outline' | 'shearLine' | 'element' | 'opening' | 'delete' | 'calibrate'

/** Plan editor state that the Toolbar sets and the PlanView uses. Not saved with the project. */
export interface EditorState {
  mode: EditorMode
  tool: EditorTool
  /** Direction of new Shear Lines in draw mode. */
  lineDirection: Axis
  /** Kind of new Lateral Elements. */
  elementKind: LateralElement['kind']
  /** Results overlay layers (B3.2) and the ghost of the Level below (B4.1). */
  layers: { labels: boolean; collectors: boolean; diagrams: boolean; ghost: boolean }
  /** While false, the Select tool can drag the Underlay to align it (B5.1). */
  underlayLocked: boolean
}

export const DEFAULT_EDITOR: EditorState = {
  mode: 'grid',
  tool: 'select',
  lineDirection: 'Y',
  elementKind: 'shearWall',
  layers: { labels: true, collectors: true, diagrams: true, ghost: true },
  underlayLocked: false,
}

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
  editor: EditorState
  setEditor: Dispatch<SetStateAction<EditorState>>
}

/** The Level shown on the plan. Falls back to the top Level if levelId is stale (e.g. after a delete or load). */
export function currentLevel(project: Project, levelId: string): Level {
  return project.levels.find((level) => level.id === levelId) ?? project.levels[project.levels.length - 1]
}
