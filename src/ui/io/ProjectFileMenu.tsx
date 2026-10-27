// Track B (B4.2): Save, Load, and New project buttons (spec §6.6). Mounted by App next to the
// Toolbar so B1.1 can own Toolbar.tsx; it can move into the Toolbar later.

import { useRef, useState } from 'react'
import { createDefaultProject } from '../../model/defaults'
import type { Project } from '../../model/project'
import type { AppViewProps } from '../../model/ui'
import { parseProjectFile, projectFileName, serializeProject } from './saveLoad'
import './ProjectFileMenu.css'

export function ProjectFileMenu({ project, setProject, setLevelId, setSelection }: AppViewProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  function open(next: Project) {
    setProject(next)
    setLevelId(next.levels[next.levels.length - 1].id)
    setSelection(null)
    setError(null)
  }

  function save() {
    const url = URL.createObjectURL(new Blob([serializeProject(project)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = projectFileName(project)
    link.click()
    URL.revokeObjectURL(url)
  }

  async function load(file: File | undefined) {
    if (!file) return
    const parsed = parseProjectFile(await file.text())
    if (parsed.ok) open(parsed.project)
    else setError(`${file.name}: ${parsed.error}`)
  }

  function startNew() {
    if (window.confirm('Start a new project? Anything you have not saved to a file will be lost.')) open(createDefaultProject())
  }

  return (
    <div className="file-menu">
      <button onClick={save}>Save</button>
      <button onClick={() => fileInput.current?.click()}>Load</button>
      <button onClick={startNew}>New</button>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(event) => {
          void load(event.target.files?.[0])
          event.target.value = '' // so loading the same file again still fires
        }}
      />
      {error && (
        <span className="file-menu-error" role="alert">
          {error}{' '}
          <button className="link" onClick={() => setError(null)}>
            Dismiss
          </button>
        </span>
      )}
    </div>
  )
}
