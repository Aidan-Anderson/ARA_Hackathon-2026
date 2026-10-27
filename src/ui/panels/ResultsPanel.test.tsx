import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { t1, t1w, t3, t5, t6, t7 } from '../../model/fixtures'
import type { Project } from '../../model/project'
import type { CaseView } from '../../model/ui'
import { ResultsPanel } from './ResultsPanel'
import { plainHtml, viewProps } from './testProps'

function render(project: Project, caseId: CaseView, levelId?: string): string {
  return plainHtml(renderToString(<ResultsPanel {...viewProps(project, caseId, levelId)} />))
}

describe('ResultsPanel', () => {
  it('offers all four Load Cases and the Envelope', () => {
    const html = render(t1(), 'SY')
    for (const label of ['Seismic X', 'Seismic Y', 'Wind X', 'Wind Y', 'Envelope']) expect(html).toContain(label)
  })

  it('shows T1 SY Level forces and Diaphragm Reactions, each with its ASD value', () => {
    const html = render(t1(), 'SY')
    expect(html).toContain('26.00<span class="asd">18.20</span>') // F_x and Σ reactions
    expect(html).toContain('120.00') // seismic weight
    for (const [strength, asd] of [['5.20', '3.64'], ['13.00', '9.10'], ['7.80', '5.46']]) {
      expect(html).toContain(`${strength}<span class="asd">${asd}</span>`)
    }
  })

  it('shows F_px with what governs, and the Diaphragm Spans table', () => {
    const html = render(t1(), 'SY')
    expect(html).toContain('minimum governs')
    expect(html).toContain('31.20<span class="asd">21.84</span>')
    expect(html).toContain('Diaphragm Spans')
    expect(html).toContain('1→2')
    expect(html).toContain('140.4<span class="asd">98.3</span>') // span 2→3 max M
    expect(html).toContain('2.81<span class="asd">1.97</span>') // span 2→3 Chord (1.966 at ASD)
  })

  it('shows Lateral Element Demands and Collector forces (T1)', () => {
    const html = render(t1(), 'SY')
    expect(html).toContain('Lateral Elements')
    expect(html).toContain('650.0<span class="asd">455.0</span>') // line 2 wall
    expect(html).toContain('Collectors')
    expect(html).toContain('9.36<span class="asd">6.55</span>') // line 2 Collector
  })

  it('shows wind results with the 0.6 ASD factor and no F_px (T1w WY)', () => {
    const html = render(t1w(), 'WY')
    expect(html).toContain('Wind on the Level')
    expect(html).toContain('15.00<span class="asd">9.00</span>') // line 2
    expect(html).not.toContain('Diaphragm Force F_px')
  })

  it('shows the Envelope with the governing case for strength and ASD (T1w)', () => {
    const html = render(t1w(), 'ENV')
    expect(html).toContain('Envelope: Roof')
    expect(html).toContain('2: Wall 0–20')
    expect(html).toContain('15.00 k <span class="muted">WY</span>')
    expect(html).toContain('9.10 k <span class="muted">SY</span>')
  })

  it('follows the inputs: doubling F_x doubles the reactions', () => {
    const project = t1()
    project.levels[0].seismic.fxPsf = 10.4
    const html = render(project, 'SY')
    for (const reaction of ['10.40', '26.00', '15.60', '52.00']) expect(html).toContain(`${reaction}<span class="asd">`)
  })

  it('makes rows selectable and highlights the selected one', () => {
    const selection = { kind: 'shearLine', levelId: 'roof', id: 'roof-2' } as const
    const html = plainHtml(renderToString(<ResultsPanel {...viewProps(t1(), 'SY', 'roof', selection)} />))
    expect(html).toContain('class="selectable selected"')
    expect(html).toContain('class="selectable"')
  })

  it('tags the Roof line that stops (T5)', () => {
    const html = render(t5(), 'SY', 'roof')
    expect(html).toContain('stops ↓')
    expect(html).toContain('Story shear')
  })

  it('lists the Transfer into Level 2 with its Collector (T5)', () => {
    const html = render(t5(), 'SY', 'level-2')
    expect(html).toContain('Transfers into this Diaphragm')
    expect(html).toContain('Roof, line 2')
    expect(html).toContain('15.00<span class="asd">10.50</span>') // transfer force
    expect(html).toContain('300.0<span class="asd">210.0</span>') // Collector plf
    expect(html).toContain('30.00<span class="asd">21.00</span>') // ground-story shear on lines 1 and 3
  })

  it('lists Re-entrant Corners for the L-shape (T3)', () => {
    const html = render(t3(), 'SY')
    expect(html).toContain('Re-entrant Corners')
    expect(html).toContain('(30, 25)')
    expect(html).toContain('6.75<span class="asd">4.72</span>') // 0.7 × 6.75 = 4.725, shown to 2 places
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
