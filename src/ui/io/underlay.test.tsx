import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { t1 } from '../../model/fixtures'
import type { Underlay } from '../../model/project'
import { DEFAULT_EDITOR, type EditorState } from '../../model/ui'
import { plainHtml, viewProps } from '../panels/testProps'
import { setUnderlay } from '../plan/edit'
import { addLevelOnTop } from '../plan/levels'
import { PlanView } from '../plan/PlanView'
import { Toolbar } from '../plan/Toolbar'
import { parseProjectFile, serializeProject } from './saveLoad'
import { calibrateUnderlay, insideUnderlay, moveUnderlay, placeUnderlay, underlayBounds } from './underlay'
import { readUnderlayFile } from './underlayFile'

const image = { dataUrl: 'data:image/png;base64,AAAA', widthPx: 1000, heightPx: 500 }
const placed: Underlay = placeUnderlay(image, 100)

function withUnderlay() {
  return setUnderlay(t1(), 'roof', placed)
}

describe('Underlay geometry (B5.1)', () => {
  it('is first placed at (0, 0), as wide as the plan, half see-through', () => {
    expect(placed).toEqual({ ...image, ftPerPx: 0.1, x: 0, y: 0, opacity: 0.5 })
    expect(placeUnderlay(image, 0).ftPerPx).toBe(0.1) // no Grid or outline yet: a fallback scale
  })

  it('calibrates from two clicked points and the real distance, bottom-left back at (0, 0)', () => {
    // Two points 50 ft apart at the provisional scale = 500 px. Really 100 ft apart → 0.2 ft per px.
    const calibrated = calibrateUnderlay(moveUnderlay(placed, 7, 3), { x: 10, y: 5 }, { x: 60, y: 5 }, 100)!
    expect(calibrated.ftPerPx).toBeCloseTo(0.2, 12)
    expect([calibrated.x, calibrated.y]).toEqual([0, 0])
    expect(underlayBounds(calibrated)).toEqual({ xMin: 0, xMax: 200, yMin: 0, yMax: 100 })
  })

  it('refuses a calibration with the same point twice or a distance that isn’t positive', () => {
    expect(calibrateUnderlay(placed, { x: 10, y: 5 }, { x: 10, y: 5 }, 100)).toBeNull()
    expect(calibrateUnderlay(placed, { x: 10, y: 5 }, { x: 60, y: 5 }, 0)).toBeNull()
    expect(calibrateUnderlay(placed, { x: 10, y: 5 }, { x: 60, y: 5 }, NaN)).toBeNull()
  })

  it('moves, and knows what is on it', () => {
    const moved = moveUnderlay(placed, -5, 10)
    expect(underlayBounds(moved)).toEqual({ xMin: -5, xMax: 95, yMin: 10, yMax: 60 })
    expect(insideUnderlay(moved, { x: 0, y: 20 })).toBe(true)
    expect(insideUnderlay(moved, { x: 0, y: 5 })).toBe(false)
  })
})

describe('Underlay on the Level (B5.1)', () => {
  it('is set, replaced, and removed', () => {
    expect(withUnderlay().levels[0].underlay).toEqual(placed)
    const replaced = setUnderlay(withUnderlay(), 'roof', { ...placed, opacity: 0.8 })
    expect(replaced.levels[0].underlay?.opacity).toBe(0.8)
    expect('underlay' in setUnderlay(withUnderlay(), 'roof', undefined).levels[0]).toBe(false)
  })

  it('is saved with the project and copied by "+ Level"', () => {
    const parsed = parseProjectFile(serializeProject(withUnderlay()))
    expect(parsed.ok && parsed.project.levels[0].underlay).toEqual(placed)
    const added = addLevelOnTop(withUnderlay())
    expect(added.project.levels[1].underlay).toEqual(placed)
  })

  it('rejects files that aren’t PNG, JPG, or PDF', async () => {
    await expect(readUnderlayFile(new File(['hello'], 'notes.txt', { type: 'text/plain' }))).rejects.toThrow(
      'Choose a PNG, JPG, or PDF file.',
    )
  })
})

describe('Underlay UI (B5.1)', () => {
  const plan = (editor: Partial<EditorState> = {}) =>
    plainHtml(renderToString(<PlanView {...{ ...viewProps(withUnderlay()), editor: { ...DEFAULT_EDITOR, ...editor } }} />))
  const toolbar = (project = withUnderlay(), editor: Partial<EditorState> = {}) =>
    plainHtml(renderToString(<Toolbar {...{ ...viewProps(project), editor: { ...DEFAULT_EDITOR, ...editor } }} />))

  it('draws the Underlay first, at its opacity', () => {
    const html = plan()
    expect(html).toContain('<image class="underlay" href="data:image/png;base64,AAAA"')
    expect(html).toContain('opacity="0.5"')
    expect(html.indexOf('class="underlay"')).toBeLessThan(html.indexOf('class="outline"'))
  })

  it('explains calibration and aligning', () => {
    expect(plan({ tool: 'calibrate' })).toContain('Calibrate: click the first of two points')
    expect(plan({ tool: 'select' })).toContain('Drag the drawing to align it, then tick Lock')
    expect(plan({ tool: 'select', underlayLocked: true })).not.toContain('Drag the drawing')
  })

  it('shows the Underlay controls in Import mode only', () => {
    expect(toolbar(t1(), { mode: 'import' })).toContain('Import image or PDF…')
    const html = toolbar(withUnderlay(), { mode: 'import' })
    for (const control of ['Replace…', '>Calibrate<', 'type="range"', 'Lock', '>Remove<', '1 px = 0.100 ft']) {
      expect(html).toContain(control)
    }
    expect(toolbar(withUnderlay(), { mode: 'grid' })).not.toContain('aria-label="Underlay"')
  })
})
