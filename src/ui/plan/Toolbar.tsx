// Track B: mode/tool buttons, Level picker, Load Case picker, Strength/ASD, Save/Load (spec §6.1).
// Tickets B1.1, B3.2, B4.1, B4.2.

import { currentLevel, type AppViewProps } from '../../model/ui'
import type { EditorProps, Mode, Tool } from './editor'
import './Toolbar.css'

interface Option<T> {
  id: T
  label: string
  /** Not built yet. */
  disabled?: boolean
}

const MODES: Option<Mode>[] = [
  { id: 'grid', label: 'Grid' },
  { id: 'draw', label: 'Draw', disabled: true },
  { id: 'import', label: 'Import', disabled: true },
]

const TOOLS: Option<Tool>[] = [
  { id: 'select', label: 'Select' },
  { id: 'shearLine', label: 'Shear Line' },
]

export function Toolbar({ project, levelId, caseId, showAsd, editor, setEditor }: AppViewProps & EditorProps) {
  return (
    <div className="toolbar" role="toolbar" aria-label="Toolbar">
      <Choice label="Mode" options={MODES} value={editor.mode} onChange={(mode) => setEditor((e) => ({ ...e, mode }))} />
      <Choice label="Tool" options={TOOLS} value={editor.tool} onChange={(tool) => setEditor((e) => ({ ...e, tool }))} />
      <span className="toolbar-status">
        {project.name} · Level: {currentLevel(project, levelId).name} · Case: {caseId} · {showAsd ? 'ASD' : 'Strength'}
      </span>
    </div>
  )
}

/** A labeled row of toggle buttons; exactly one is pressed. */
function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: Option<T>[]
  value: T
  onChange: (id: T) => void
}) {
  return (
    <div className="toolbar-choice" role="group" aria-label={label}>
      <span className="toolbar-choice-label">{label}</span>
      <div className="toolbar-buttons">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={option.id === value}
            disabled={option.disabled}
            title={option.disabled ? 'Coming soon' : undefined}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
