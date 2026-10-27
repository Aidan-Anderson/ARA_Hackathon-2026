import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App skeleton', () => {
  it('renders every region with the default project', () => {
    // Drop the <!-- --> markers React puts between adjacent text nodes.
    const html = renderToString(<App />).replaceAll('<!-- -->', '')
    for (const region of ['Toolbar', 'Plan view', 'Loads', 'Results', 'Detail', 'Code calc', 'Warnings']) {
      expect(html).toContain(region)
    }
    // The plan shows T1's Shear Lines (B1.1).
    for (const name of ['1', '2', '3', 'A', 'B']) expect(html).toContain(`<title>Shear Line ${name}</title>`)
  })
})
