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
    expect(html).toContain('Roof: 4-point outline, 5 Shear Lines')
  })
})
