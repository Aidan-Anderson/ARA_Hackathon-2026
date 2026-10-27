// Shared skeleton (docs/spec.md §4.2, §6.1). Each region belongs to one track; announce changes here in the commit message.

import { useMemo, useState } from 'react'
import { analyze } from './engine/analyze'
import { createDefaultProject } from './model/defaults'
import type { Project } from './model/project'
import type { AppViewProps, CaseView, Selection } from './model/ui'
import { ProjectFileMenu } from './ui/io/ProjectFileMenu'
import { loadAutosave } from './ui/io/saveLoad'
import { useAutosave } from './ui/io/useAutosave'
import { DetailPanel } from './ui/panels/DetailPanel'
import { LoadForm } from './ui/panels/LoadForm'
import { ResultsPanel } from './ui/panels/ResultsPanel'
import { SeismicCodePanel } from './ui/panels/SeismicCodePanel'
import { Warnings } from './ui/panels/Warnings'
import { initialEditorState, type EditorState } from './ui/plan/editor'
import { PlanView } from './ui/plan/PlanView'
import { Toolbar } from './ui/plan/Toolbar'
import './App.css'

const TABS = ['Loads', 'Results', 'Detail', 'Code calc'] as const
type Tab = (typeof TABS)[number]

export default function App() {
  // Start from the autosave when there is one (spec §6.6).
  const [project, setProject] = useState<Project>(() => loadAutosave() ?? createDefaultProject())
  const [levelId, setLevelId] = useState(() => project.levels[project.levels.length - 1].id)
  const [caseId, setCaseId] = useState<CaseView>('SY')
  const [selection, setSelection] = useState<Selection>(null)
  const [showAsd, setShowAsd] = useState(false)
  const [tab, setTab] = useState<Tab>('Results')
  // Track B's plan editor (mode, tool); only Toolbar and PlanView use it.
  const [editor, setEditor] = useState<EditorState>(initialEditorState)
  const results = useMemo(() => analyze(project), [project])
  const autosaveNotice = useAutosave(project)

  // Selecting an element (a Results row, or the plan) opens its details.
  const select: AppViewProps['setSelection'] = (next) => {
    const value = typeof next === 'function' ? next(selection) : next
    setSelection(value)
    if (value) setTab('Detail')
  }

  const view: AppViewProps = {
    project,
    setProject,
    results,
    levelId,
    setLevelId,
    caseId,
    setCaseId,
    showAsd,
    setShowAsd,
    selection,
    setSelection: select,
  }

  return (
    <div className="app">
      <header className="app-toolbar">
        <Toolbar {...view} editor={editor} setEditor={setEditor} />
        <Toolbar {...view} />
        <ProjectFileMenu {...view} />
      </header>
      <main className="app-plan">
        <PlanView {...view} editor={editor} setEditor={setEditor} />
      </main>
      <aside className="app-side">
        <nav className="tabs">
          {TABS.map((name) => (
            <button key={name} className={name === tab ? 'tab active' : 'tab'} onClick={() => setTab(name)}>
              {name}
            </button>
          ))}
        </nav>
        <div className="tab-body">
          {tab === 'Loads' && <LoadForm {...view} />}
          {tab === 'Results' && <ResultsPanel {...view} />}
          {tab === 'Detail' && <DetailPanel {...view} />}
          {tab === 'Code calc' && <SeismicCodePanel {...view} />}
        </div>
      </aside>
      <footer className="app-warnings">
        {autosaveNotice && <div className="autosave-notice">{autosaveNotice}</div>}
        <Warnings {...view} />
      </footer>
    </div>
  )
}
