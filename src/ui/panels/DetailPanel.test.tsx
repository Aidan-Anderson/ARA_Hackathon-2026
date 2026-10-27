import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { t1, t4, t5 } from '../../model/fixtures'
import type { Project } from '../../model/project'
import type { Selection } from '../../model/ui'
import { DetailPanel } from './DetailPanel'
import { plainHtml, viewProps } from './testProps'

function render(project: Project, selection: Selection): string {
  const levelId = selection?.levelId ?? project.levels[0].id
  return plainHtml(renderToString(<DetailPanel {...viewProps(project, 'SY', levelId, selection)} />))
}

/** The cells of the table row that starts with `label`, in the section titled `title`. */
function row(html: string, title: string, label: string): string[] {
  const section = html.slice(html.indexOf(`<h3>${title}</h3>`))
  const match = section.match(new RegExp(`<tr><td>${label}</td>(.*?)</tr>`))
  return match ? [...match[1].matchAll(/<td>(.*?)<\/td>/g)].map((m) => m[1]) : []
}

const line2Element: Selection = { kind: 'lateralElement', levelId: 'roof', lineId: 'roof-2', id: 'roof-2-e1' }
const line2: Selection = { kind: 'shearLine', levelId: 'roof', id: 'roof-2' }

describe('DetailPanel', () => {
  it('asks for a selection when there is none', () => {
    expect(render(t1(), null)).toContain('Click a row in Results')
  })

  it('T1 line 2 wall with ρ = 1.3: E 13.00, ρ·E 16.90, ASD 11.83 in Seismic Y', () => {
    const project = t1()
    project.loads.rho = 1.3
    const html = render(project, line2Element)
    expect(html).toContain('Using ρ = 1.3')
    expect(row(html, 'Force', 'Seismic Y')).toEqual(['13.00', '16.90', '11.83'])
  })

  it('wind rows show no ρ: E and 0.6·E only', () => {
    const project = t1()
    project.loads.rho = 1.3
    project.loads.windPlf.Y = 300
    expect(row(render(project, line2Element), 'Force', 'Wind Y')).toEqual(['15.00', '—', '9.00'])
  })

  it('lists only the Load Cases in the element’s direction, plus the Envelope', () => {
    const html = render(t1(), line2Element)
    expect(html).toContain('Seismic Y')
    expect(html).not.toContain('Seismic X')
    expect(html).toContain('<td>Envelope</td>')
  })

  it('T1 line 2 Collector: E 9.36, Ω₀·E 28.08 (Ω₀ = 3), ASD 19.66', () => {
    const html = render(t1(), line2)
    expect(html).toContain('using Ω₀ = 3')
    expect(row(html, 'Collector force', 'Seismic Y')).toEqual(['9.36', '28.08', '19.66'])
    expect(row(html, 'Collector force', 'Wind Y')).toEqual(['0.00', '—', '0.00'])
  })

  it('shows the line’s reactions and story shear', () => {
    const html = render(t1(), line2)
    expect(html).toContain('Shear Line 2 (Y)')
    expect(html).toContain('13.00<span class="asd">9.10</span>') // R at F_x and story shear
    expect(html).toContain('15.60<span class="asd">10.92</span>') // R at F_px
  })

  it('T5 transfer into Level 2: 15.0 k, 300 plf, Collector 9.00 with Ω₀·E 27.00', () => {
    const html = render(t5(), { kind: 'transfer', levelId: 'level-2', fromLineId: 'roof-2' })
    expect(html).toContain('Transfer from Roof, Shear Line 2')
    expect(html).toContain('15.00<span class="asd">10.50</span>')
    expect(html).toContain('300.0<span class="asd">210.0</span>')
    expect(row(html, 'Transfer Collector force', 'Seismic Y')).toEqual(['9.00', '27.00', '18.90'])
  })

  it('T4 Opening: 10 × 10 ft, 100 sf', () => {
    const html = render(t4(), { kind: 'opening', levelId: 'roof', id: 'roof-o1' })
    expect(html).toContain('10.0 × 10.0 ft')
    expect(html).toContain('100 sf')
  })

  it('says so when the selected item is gone', () => {
    expect(render(t1(), { kind: 'shearLine', levelId: 'roof', id: 'deleted' })).toContain('no longer exists')
  })
})
