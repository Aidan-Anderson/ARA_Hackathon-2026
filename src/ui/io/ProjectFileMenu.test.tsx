import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { t1 } from '../../model/fixtures'
import { plainHtml, viewProps } from '../panels/testProps'
import { ProjectFileMenu } from './ProjectFileMenu'

describe('ProjectFileMenu', () => {
  it('offers Save, Load, and New, with a hidden JSON file picker', () => {
    const html = plainHtml(renderToString(<ProjectFileMenu {...viewProps(t1())} />))
    for (const label of ['>Save<', '>Load<', '>New<']) expect(html).toContain(label)
    expect(html).toContain('type="file"')
    expect(html).toContain('accept=".json,application/json"')
  })
})
