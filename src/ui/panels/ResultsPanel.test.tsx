import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { analyze } from '../../engine/analyze'
import { t1, t3, t6, t7 } from '../../model/fixtures'
import type { Project } from '../../model/project'
import type { AppViewProps, CaseView } from '../../model/ui'
import { ResultsPanel } from './ResultsPanel'

function render(project: Project, caseId: CaseView): string {
  const noop = () => {}
  const props: AppViewProps = {
    project,
    setProject: noop,
    results: analyze(project),
    levelId: project.levels[0].id,
    setLevelId: noop,
    caseId,
    setCaseId: noop,
    showAsd: false,
    setShowAsd: noop,
    selection: null,
    setSelection: noop,
  }
  // Drop the <!-- --> markers React puts between adjacent text nodes.
  return renderToString(<ResultsPanel {...props} />).replaceAll('<!-- -->', '')
}

describe('ResultsPanel', () => {
  it('shows T1 SY Level forces and Diaphragm Reactions', () => {
    const html = render(t1(), 'SY')
    expect(html).toContain('26.00 k') // F_x and Σ reactions
    expect(html).toContain('120.00 k') // seismic weight
    for (const reaction of ['5.20 k', '13.00 k', '7.80 k']) expect(html).toContain(reaction)
  })

  it('shows F_px with what governs, and the Diaphragm Spans table', () => {
    const html = render(t1(), 'SY')
    expect(html).toContain('31.20 k') // F_px design
    expect(html).toContain('minimum governs')
    expect(html).toContain('Diaphragm Spans')
    expect(html).toContain('1→2')
    expect(html).toContain('140.4 k-ft') // span 2→3 max M
    expect(html).toContain('187.2 plf') // span 2→3 max v
  })

  it('follows the inputs: doubling F_x doubles the reactions', () => {
    const project = t1()
    project.levels[0].seismic.fxPsf = 10.4
    const html = render(project, 'SY')
    for (const reaction of ['10.40 k', '26.00 k', '15.60 k', '52.00 k']) expect(html).toContain(reaction)
  })

  it('lists Re-entrant Corners for the L-shape (T3)', () => {
    const html = render(t3(), 'SY')
    expect(html).toContain('Re-entrant Corners')
    expect(html).toContain('(30, 25)')
    expect(html).toContain('6.75 k')
  })

  it('labels an Overhang by its free end (T7)', () => {
    expect(render(t7(), 'SY')).toContain('2→free end')
  })

  it('shows the outline error instead of tables for an unsupported shape (T6)', () => {
    const html = render(t6(), 'SY')
    expect(html).toContain('not supported')
    expect(html).not.toContain('Level forces')
  })

  it('asks for a second Shear Line when a direction has only one', () => {
    const project = t1()
    project.levels[0].shearLines = project.levels[0].shearLines.filter((line) => line.name !== 'B')
    expect(render(project, 'SX')).toContain('Needs at least two Shear Lines in X')
  })
})
