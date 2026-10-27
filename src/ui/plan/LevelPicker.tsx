// Track B (B4.1): Level picker, "+ Level", Delete Level, and the ghost toggle (spec §6.4).
// Rename is the Name field in the Load form.

import { currentLevel, type AppViewProps } from '../../model/ui'
import { addLevelOnTop, deleteLevel } from './levels'
import './LevelPicker.css'

export function LevelPicker({ project, setProject, levelId, setLevelId, setSelection, editor, setEditor }: AppViewProps) {
  const level = currentLevel(project, levelId)
  const canDelete = project.levels.length > 1

  function addLevel() {
    const added = addLevelOnTop(project)
    setProject(added.project)
    setLevelId(added.levelId)
  }

  function removeLevel() {
    if (!canDelete || !window.confirm(`Delete ${level.name}?`)) return
    const index = project.levels.findIndex((l) => l.id === level.id)
    const next = project.levels[index > 0 ? index - 1 : 1]
    setProject((p) => deleteLevel(p, level.id))
    setLevelId(next.id)
    setSelection((s) => (s && s.levelId === level.id ? null : s))
  }

  return (
    <div className="level-picker" role="group" aria-label="Level">
      <span className="segmented-label">Level</span>
      <select aria-label="Current Level" value={level.id} onChange={(event) => setLevelId(event.target.value)}>
        {/* Top Level first, as in a building section. */}
        {[...project.levels].reverse().map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <button title="Add a Level on top, copied from the top Level" onClick={addLevel}>
        + Level
      </button>
      <button title={canDelete ? `Delete ${level.name}` : 'The only Level cannot be deleted'} disabled={!canDelete} onClick={removeLevel}>
        Delete
      </button>
      <label title="Show the Level below faintly">
        <input
          type="checkbox"
          checked={editor.layers.ghost}
          onChange={(event) => setEditor((e) => ({ ...e, layers: { ...e.layers, ghost: event.target.checked } }))}
        />
        Ghost
      </label>
    </div>
  )
}
