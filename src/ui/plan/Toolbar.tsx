// Track B: plan editor controls (spec §6.1): mode and tool. Later tickets add the drawing options
// (B2.1), Load Case picker and Strength/ASD (B3.2), and the Level picker (B4.1).

import type { Axis } from '../../model/project'
import type { AppViewProps, EditorMode, EditorTool } from '../../model/ui'
import './Toolbar.css'

const MODES: { id: EditorMode; label: string }[] = [
  { id: 'grid', label: 'Grid' },
  { id: 'draw', label: 'Draw' },
  { id: 'import', label: 'Import' },
]

const TOOLS: { id: EditorTool; label: string }[] = [
  { id: 'select', label: 'Select' },
  { id: 'outline', label: 'Outline' },
  { id: 'shearLine', label: 'Shear Line' },
]

const DIRECTIONS: { id: Axis; label: string }[] = [
  { id: 'X', label: 'X' },
  { id: 'Y', label: 'Y' },
]

/** Modes that work so far; the rest show as disabled. */
const READY_MODES: EditorMode[] = ['grid', 'draw']

export function Toolbar({ editor, setEditor }: AppViewProps) {
  return (
    <div className="toolbar">
      <Segmented
        label="Mode"
        options={MODES.map((mode) => ({ ...mode, disabled: !READY_MODES.includes(mode.id) }))}
        value={editor.mode}
        onChange={(mode) => setEditor((e) => ({ ...e, mode }))}
      />
      <Segmented label="Tool" options={TOOLS} value={editor.tool} onChange={(tool) => setEditor((e) => ({ ...e, tool }))} />
      {editor.tool === 'shearLine' && editor.mode !== 'grid' && (
        <Segmented
          label="Direction"
          options={DIRECTIONS}
          value={editor.lineDirection}
          onChange={(lineDirection) => setEditor((e) => ({ ...e, lineDirection }))}
        />
      )}
    </div>
  )
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { id: T; label: string; disabled?: boolean }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      <span className="segmented-label">{label}</span>
      {options.map((option) => (
        <button
          key={option.id}
          className={option.id === value ? 'active' : undefined}
          disabled={option.disabled}
          aria-pressed={option.id === value}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
