// Shared skeleton (docs/spec.md §4.2, §6.1). Each region belongs to one track; announce changes here in the commit message.

import { useMemo, useState } from 'react'
import { analyze } from './engine/analyze'
import { createDefaultProject } from './model/defaults'
import type { Project } from './model/project'
import type { AppViewProps, CaseView, Selection } from './model/ui'
import { DetailPanel } from './ui/panels/DetailPanel'
import { LoadForm } from './ui/panels/LoadForm'
import { ResultsPanel } from './ui/panels/ResultsPanel'
import { SeismicCodePanel } from './ui/panels/SeismicCodePanel'
import { Warnings } from './ui/panels/Warnings'
import { PlanView } from './ui/plan/PlanView'
import { Toolbar } from './ui/plan/Toolbar'
import './App.css'

const TABS = ['Loads', 'Results', 'Detail', 'Code calc'] as const
type Tab = (typeof TABS)[number]

export default function App() {
  // B4.2 starts from the autosave when there is one (spec §6.6).
  const [project, setProject] = useState<Project>(createDefaultProject)
  const [levelId, setLevelId] = useState(() => project.levels[project.levels.length - 1].id)
  const [caseId, setCaseId] = useState<CaseView>('SY')
  const [selection, setSelection] = useState<Selection>(null)
  const [showAsd, setShowAsd] = useState(false)
  const [tab, setTab] = useState<Tab>('Results')
  const results = useMemo(() => analyze(project), [project])

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
    setSelection,
  }

  return (
    <div className="app">
      <header className="app-toolbar">
        <Toolbar {...view} />
      </header>
      <main className="app-plan">
        <PlanView {...view} />
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
        <Warnings {...view} />
      </footer>
    </div>
  )
}
