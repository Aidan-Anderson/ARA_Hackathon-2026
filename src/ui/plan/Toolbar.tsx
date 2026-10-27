// Track B: plan editor controls (spec §6.1): mode and tool. Later tickets add the drawing options
// (B2.1), Load Case picker and Strength/ASD (B3.2), and the Level picker (B4.1).

import type { Axis, LateralElement } from '../../model/project'
import { LOAD_CASES } from '../../model/results'
import type { AppViewProps, CaseView, EditorMode, EditorState, EditorTool } from '../../model/ui'
import './Toolbar.css'

const CASES: { id: CaseView; label: string; title: string }[] = [
  ...LOAD_CASES.map(({ id, label }) => ({ id, label: id, title: label })),
  { id: 'ENV', label: 'ENV', title: 'Envelope' },
]

const VALUE_LEVELS: { id: 'strength' | 'asd'; label: string }[] = [
  { id: 'strength', label: 'Strength' },
  { id: 'asd', label: 'ASD' },
]

const LAYERS: { id: keyof Omit<EditorState['layers'], 'ghost'>; label: string }[] = [
  { id: 'labels', label: 'Labels' },
  { id: 'collectors', label: 'Collectors' },
  { id: 'diagrams', label: 'Diagrams' },
]

const MODES: { id: EditorMode; label: string }[] = [
  { id: 'grid', label: 'Grid' },
  { id: 'draw', label: 'Draw' },
  { id: 'import', label: 'Import' },
]

const TOOLS: { id: EditorTool; label: string }[] = [
  { id: 'select', label: 'Select' },
  { id: 'outline', label: 'Outline' },
  { id: 'shearLine', label: 'Shear Line' },
  { id: 'element', label: 'Element' },
  { id: 'opening', label: 'Opening' },
  { id: 'delete', label: 'Delete' },
]

const KINDS: { id: LateralElement['kind']; label: string }[] = [
  { id: 'shearWall', label: 'Shear wall' },
  { id: 'bracedFrame', label: 'Braced frame' },
]

const DIRECTIONS: { id: Axis; label: string }[] = [
  { id: 'X', label: 'X' },
  { id: 'Y', label: 'Y' },
]

/** Modes that work so far; the rest show as disabled. */
const READY_MODES: EditorMode[] = ['grid', 'draw']

export function Toolbar({ editor, setEditor, caseId, setCaseId, showAsd, setShowAsd }: AppViewProps) {
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
      {editor.tool === 'element' && (
        <Segmented
          label="Kind"
          options={KINDS}
          value={editor.elementKind}
          onChange={(elementKind) => setEditor((e) => ({ ...e, elementKind }))}
        />
      )}
      <Segmented label="Case" options={CASES} value={caseId} onChange={setCaseId} />
      <Segmented
        label="Values"
        options={VALUE_LEVELS}
        value={showAsd ? 'asd' : 'strength'}
        onChange={(level) => setShowAsd(level === 'asd')}
      />
      <div className="layer-toggles" role="group" aria-label="Show">
        <span className="segmented-label">Show</span>
        {LAYERS.map((layer) => (
          <label key={layer.id}>
            <input
              type="checkbox"
              checked={editor.layers[layer.id]}
              onChange={(event) =>
                setEditor((e) => ({ ...e, layers: { ...e.layers, [layer.id]: event.target.checked } }))
              }
            />
            {layer.label}
          </label>
        ))}
      </div>
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
  options: { id: T; label: string; title?: string; disabled?: boolean }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      <span className="segmented-label">{label}</span>
      {options.map((option) => (
        <button
          key={option.id}
          title={option.title}
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
