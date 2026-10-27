import { describe, expect, it } from 'vitest'
import { t1 } from '../../model/fixtures'
import { contentBox, FIT_MARGIN, fitView, toScreen, zoomAt } from './view'

describe('toScreen', () => {
  it('flips y, so the model stays y-up', () => {
    const view = { scale: 2, tx: 10, ty: 100 }
    expect(toScreen(view, { x: 0, y: 0 })).toEqual({ x: 10, y: 100 })
    expect(toScreen(view, { x: 5, y: 20 })).toEqual({ x: 20, y: 60 })
  })
})

describe('contentBox', () => {
  it('covers the grid and the outline', () => {
    const project = t1()
    expect(contentBox(project.grid, project.levels[0])).toEqual({ xMin: 0, yMin: 0, xMax: 100, yMax: 50 })
  })

  it('stretches to Shear Lines outside them', () => {
    const project = t1()
    const level = project.levels[0]
    level.shearLines[0] = { ...level.shearLines[0], position: 130 }
    expect(contentBox(project.grid, level).xMax).toBe(130)
  })
})

describe('fitView', () => {
  it('fits T1 inside the margins, centered', () => {
    const size = { width: 800, height: 600 }
    const view = fitView({ xMin: 0, yMin: 0, xMax: 100, yMax: 50 }, size)
    const bottomLeft = toScreen(view, { x: 0, y: 0 })
    const topRight = toScreen(view, { x: 100, y: 50 })
    // The width limits the scale here.
    expect(bottomLeft.x).toBeCloseTo(FIT_MARGIN.left)
    expect(topRight.x).toBeCloseTo(size.width - FIT_MARGIN.right)
    expect(bottomLeft.y).toBeGreaterThan(topRight.y)
    expect((bottomLeft.y + topRight.y) / 2).toBeCloseTo((FIT_MARGIN.top + size.height - FIT_MARGIN.bottom) / 2)
  })
})

describe('zoomAt', () => {
  it('keeps the model point under the cursor in place', () => {
    const view = { scale: 4, tx: 30, ty: 300 }
    const at = { x: 150, y: 120 }
    // Under `at`: x = (150 − 30) / 4 = 30, y = (300 − 120) / 4 = 45.
    const zoomed = zoomAt(view, 2, at)
    expect(zoomed.scale).toBe(8)
    expect(toScreen(zoomed, { x: 30, y: 45 })).toEqual(at)
  })
})
