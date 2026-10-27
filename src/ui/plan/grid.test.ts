import { describe, expect, it } from 'vitest'
import { t1 } from '../../model/fixtures'
import { addShearLineOnGridline, gridExtents, gridlines, gridOutline, hasShearLineOn, parseSpacings, type Gridline } from './grid'

describe('gridlines', () => {
  it('numbers vertical Gridlines left to right and letters horizontal ones bottom to top, starting at 0', () => {
    expect(gridlines({ xSpacings: [40, 60], ySpacings: [50] })).toEqual([
      { name: '1', direction: 'Y', position: 0 },
      { name: '2', direction: 'Y', position: 40 },
      { name: '3', direction: 'Y', position: 100 },
      { name: 'A', direction: 'X', position: 0 },
      { name: 'B', direction: 'X', position: 50 },
    ])
  })

  it('continues the letters past Z with AA, AB', () => {
    const lettered = gridlines({ xSpacings: [10], ySpacings: Array(27).fill(10) }).filter((g) => g.direction === 'X')
    expect(lettered.slice(24).map((g) => g.name)).toEqual(['Y', 'Z', 'AA', 'AB'])
  })

  it('rounds the running sums', () => {
    expect(gridlines({ xSpacings: [0.1, 0.2], ySpacings: [1] })[2].position).toBe(0.3)
  })
})

describe('parseSpacings', () => {
  it('reads a comma list', () => {
    expect(parseSpacings('20, 20, 30, 30')).toEqual([20, 20, 30, 30])
  })

  it('accepts spaces, decimals, and a trailing comma', () => {
    expect(parseSpacings(' 12.5 25,')).toEqual([12.5, 25])
  })

  it('rejects empty lists, zero, negatives, and non-numbers', () => {
    for (const text of ['', ' , ', '20, 0', '20, -5', '20, x', '20, 1e999']) expect(parseSpacings(text)).toBeNull()
  })
})

describe('gridOutline', () => {
  it('is a counter-clockwise rectangle over the grid extents', () => {
    const grid = { xSpacings: [20, 20, 30, 30], ySpacings: [25, 25] }
    expect(gridExtents(grid)).toEqual({ x: 100, y: 50 })
    expect(gridOutline(grid)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 0, y: 50 },
    ])
  })
})

describe('addShearLineOnGridline', () => {
  // T1's Roof: 100 × 50 outline with Shear Lines at x = 0, 40, 100 and y = 0, 50.
  const roof = t1().levels[0]
  const gridline = (name: string, direction: Gridline['direction'], position: number): Gridline => ({
    name,
    direction,
    position,
  })

  it('adds a Y-line on a numbered Gridline, named after it, with one full-length Lateral Element', () => {
    const level = addShearLineOnGridline(roof, gridline('2', 'Y', 20))
    expect(level.shearLines).toHaveLength(6)
    expect(level.shearLines[5]).toEqual({
      id: expect.any(String),
      name: '2',
      direction: 'Y',
      position: 20,
      lateralElements: [{ id: expect.any(String), kind: 'shearWall', start: 0, end: 50 }],
    })
    expect(roof.shearLines).toHaveLength(5)
  })

  it('adds an X-line on a lettered Gridline', () => {
    const line = addShearLineOnGridline(roof, gridline('B', 'X', 25)).shearLines[5]
    expect(line).toMatchObject({ name: 'B', direction: 'X', position: 25, lateralElements: [{ start: 0, end: 100 }] })
  })

  it('returns the Level itself if the Gridline already has a Shear Line', () => {
    const onLine2 = gridline('3', 'Y', 40)
    expect(hasShearLineOn(roof, onLine2)).toBe(true)
    expect(addShearLineOnGridline(roof, onLine2)).toBe(roof)
  })

  it('gives no Lateral Element when the Gridline misses the outline', () => {
    const level = addShearLineOnGridline(roof, gridline('5', 'Y', 130))
    expect(level.shearLines[5].lateralElements).toEqual([])
  })
})
