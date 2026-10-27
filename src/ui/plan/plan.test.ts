// Pure plan-editor logic: Gridlines, the viewport, and edits.

import { describe, expect, it } from 'vitest'
import { t1, t3 } from '../../model/fixtures'
import { addShearLine, setGrid } from './edit'
import { gridlines, gridRectangle, letterLabel, nearestGridline, parseSpacings } from './grid'
import { fitViewport, toPlan, toScreen, zoomAt } from './viewport'

describe('Gridlines', () => {
  it('labels lettered Gridlines A, B, … skipping I and O, then AA', () => {
    expect([0, 1, 7, 8, 12, 13, 23, 24, 25].map(letterLabel)).toEqual(['A', 'B', 'H', 'J', 'N', 'P', 'Z', 'AA', 'AB'])
  })

  it('places T1’s Gridlines: 1, 2, 3 at x = 0, 40, 100 and A, B at y = 0, 50', () => {
    expect(gridlines(t1().grid)).toEqual([
      { label: '1', direction: 'Y', position: 0 },
      { label: '2', direction: 'Y', position: 40 },
      { label: '3', direction: 'Y', position: 100 },
      { label: 'A', direction: 'X', position: 0 },
      { label: 'B', direction: 'X', position: 50 },
    ])
  })

  it('reads spacing lists, including n@spacing shorthand', () => {
    expect(parseSpacings('20, 20, 30')).toEqual([20, 20, 30])
    expect(parseSpacings('3@20 30')).toEqual([20, 20, 20, 30])
    expect(parseSpacings('')).toEqual([])
    expect(parseSpacings('20, abc')).toBeNull()
    expect(parseSpacings('20, -5')).toBeNull()
  })

  it('makes the grid-extents rectangle', () => {
    expect(gridRectangle({ xSpacings: [40, 60], ySpacings: [50] })).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 0, y: 50 },
    ])
    expect(gridRectangle({ xSpacings: [], ySpacings: [50] })).toBeNull()
  })

  it('finds the Gridline nearest a click, within tolerance', () => {
    const lines = gridlines(t1().grid)
    expect(nearestGridline(lines, { x: 41, y: 20 }, 2)?.label).toBe('2')
    expect(nearestGridline(lines, { x: 20, y: 49 }, 2)?.label).toBe('B')
    expect(nearestGridline(lines, { x: 20, y: 25 }, 2)).toBeNull()
  })
})

describe('viewport', () => {
  it('fits a 100 × 50 plan centered in 800 × 600 px with y up', () => {
    const v = fitViewport({ xMin: 0, xMax: 100, yMin: 0, yMax: 50 }, 800, 600, 50)
    expect(v.scale).toBeCloseTo(7, 9) // (800 − 100) / 100
    expect(toScreen(v, { x: 50, y: 25 })).toEqual({ x: 400, y: 300 })
    expect(toScreen(v, { x: 0, y: 50 }).y).toBeLessThan(toScreen(v, { x: 0, y: 0 }).y)
  })

  it('round-trips screen ↔ plan, and zooms about the cursor', () => {
    const v = fitViewport({ xMin: 0, xMax: 100, yMin: 0, yMax: 50 }, 800, 600, 50)
    const p = toPlan(v, 123, 456)
    expect(toScreen(v, p).x).toBeCloseTo(123, 9)
    const zoomed = zoomAt(v, 2, 123, 456)
    expect(zoomed.scale).toBeCloseTo(14, 9)
    expect(toPlan(zoomed, 123, 456).x).toBeCloseTo(p.x, 9)
    expect(toPlan(zoomed, 123, 456).y).toBeCloseTo(p.y, 9)
  })
})

describe('edits', () => {
  it('adds a Shear Line with one full-length Lateral Element', () => {
    const project = addShearLine(t3(), 'roof', { name: '2', direction: 'Y', position: 30 })
    const added = project.levels[0].shearLines.find((line) => line.name === '2')!
    expect(added.direction).toBe('Y')
    expect(added.lateralElements).toEqual([{ id: expect.any(String), kind: 'shearWall', start: 0, end: 50 }])
  })

  it('does not add a second line at the same place', () => {
    const before = t1()
    expect(addShearLine(before, 'roof', { name: '2', direction: 'Y', position: 40 }).levels[0].shearLines).toHaveLength(5)
  })

  it('edits immutably', () => {
    const before = t1()
    const after = setGrid(before, { xSpacings: [50, 50], ySpacings: [50] })
    expect(before.grid.xSpacings).toEqual([40, 60])
    expect(after.grid.xSpacings).toEqual([50, 50])
  })
})
