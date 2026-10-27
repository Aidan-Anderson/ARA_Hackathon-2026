// Test helper: the AppViewProps a panel gets from App.tsx, for a given project and Load Case.

import { analyze } from '../../engine/analyze'
import type { Project } from '../../model/project'
import { DEFAULT_EDITOR, type AppViewProps, type CaseView, type Selection } from '../../model/ui'

export function viewProps(
  project: Project,
  caseId: CaseView = 'SY',
  levelId = project.levels[0].id,
  selection: Selection = null,
): AppViewProps {
  const noop = () => {}
  return {
    project,
    setProject: noop,
    results: analyze(project),
    levelId,
    setLevelId: noop,
    caseId,
    setCaseId: noop,
    showAsd: false,
    setShowAsd: noop,
    selection,
    setSelection: noop,
    editor: DEFAULT_EDITOR,
    setEditor: noop,
  }
}

/** renderToString output without the <!-- --> markers React puts between adjacent text nodes. */
export function plainHtml(html: string): string {
  return html.replaceAll('<!-- -->', '')
}
