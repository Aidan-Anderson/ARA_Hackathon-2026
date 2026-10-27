import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { t1, t2 } from '../../model/fixtures'
import { SeismicCodePanel } from './SeismicCodePanel'
import { plainHtml, viewProps } from './testProps'

function render(project = t2()): string {
  return plainHtml(renderToString(<SeismicCodePanel {...viewProps(project)} />))
}

describe('SeismicCodePanel', () => {
  it('shows the ELF calc for T2 with the worked-example inputs: T 0.189 s, V 60.00 k, F_x 6.00 psf', () => {
    const project = t2()
    project.loads.seismicCode = { riskCategory: 'II', siteClass: 'D', sd1: 0.65, s1: 0.55, tl: 8, r: 6.5, ct: 0.02, xExp: 0.75 }
    const html = render(project)
    expect(html).toContain('0.189 s')
    expect(html).toContain('C_s (Eq. 12.8-2)')
    expect(html).toContain('60.00 k')
    expect(html).toContain('<td>30.00</td><td>6.00</td>')
    expect(html).toContain('calculated ✓') // T2's 6 psf already matches
    expect(html).toContain('Use these F_x on every Level')
  })

  it('shows F_x that differs from the one in use', () => {
    const project = t1() // 5.2 psf in use; ELF gives 4.8
    project.loads.seismicCode = { riskCategory: 'II', siteClass: 'D', sd1: 0.65, s1: 0.55, tl: 8, r: 6.5, ct: 0.02, xExp: 0.75 }
    const html = render(project)
    expect(html).toContain('<td>4.80</td>')
    expect(html).toContain('5.2 psf')
    expect(html).not.toContain('calculated ✓')
  })

  it('starts from default inputs when the project has none', () => {
    const html = render(t1())
    expect(html).toContain('Look up from site (USGS)')
    expect(html).toContain('value="6.5"') // default R
  })
})
