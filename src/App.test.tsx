import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders every region with the default project', () => {
    // Drop the <!-- --> markers React puts between adjacent text nodes.
    const html = renderToString(<App />).replaceAll('<!-- -->', '')
    for (const region of ['aria-label="Mode"', 'aria-label="Tool"', '>Save<', 'class="plan-view', 'Loads', 'Results', 'Detail', 'Code calc', 'Warnings']) {
      expect(html).toContain(region)
    }
    expect(html).toContain('<svg') // the plan
    expect(html).toContain('class="outline"')
  })
})
