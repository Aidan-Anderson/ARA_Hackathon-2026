// Track B: plan editor state (spec §6.1, §6.2). App.tsx holds it and passes it to Toolbar and PlanView.
// Later Track B tickets add fields here, so App.tsx doesn't have to change again.

import type { Dispatch, SetStateAction } from 'react'

/** Geometry input mode. Only Grid works so far: Draw comes in B2.1, Import in B5.1. */
export type Mode = 'grid' | 'draw' | 'import'

/** Plan tool. Outline, Element, Opening, and Delete come in B2.x and B3.1. */
export type Tool = 'select' | 'shearLine'

export interface EditorState {
  mode: Mode
  tool: Tool
}

export const initialEditorState: EditorState = { mode: 'grid', tool: 'select' }

/** What App.tsx passes to Toolbar and PlanView next to AppViewProps. */
export interface EditorProps {
  editor: EditorState
  setEditor: Dispatch<SetStateAction<EditorState>>
}
