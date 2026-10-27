import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { t1, t2, t4, t6 } from '../../model/fixtures'
import { plainHtml, viewProps } from './testProps'
import { Warnings } from './Warnings'

describe('Warnings', () => {
  it('shows the T4 opening-chords warning in amber', () => {
    const html = plainHtml(renderToString(<Warnings {...viewProps(t4())} />))
    expect(html).toContain('class="warning is-warning"')
    expect(html).toContain('chord forces around Openings are not calculated')
  })

  it('shows an outline error in red (T6)', () => {
    const html = plainHtml(renderToString(<Warnings {...viewProps(t6())} />))
    expect(html).toContain('class="warning is-error"')
    expect(html).toContain('not supported')
  })

  it('says so when the Level has none (T1)', () => {
    expect(plainHtml(renderToString(<Warnings {...viewProps(t1())} />))).toContain('None on Roof')
  })

  it('counts warnings on other Levels', () => {
    const project = t2()
    project.levels[1].openings = [{ id: 'stair', xMin: 10, xMax: 20, yMin: 20, yMax: 30 }] // Roof only
    const html = plainHtml(renderToString(<Warnings {...viewProps(project, 'SY', 'level-2')} />))
    expect(html).toContain('None on Level 2')
    expect(html).toContain('+1 on other Levels')
  })
})
