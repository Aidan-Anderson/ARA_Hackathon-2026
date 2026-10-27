import { describe, expect, it } from 'vitest'
import { t1, t3 } from './fixtures'
import { crossSection } from './geometry'

describe('crossSection', () => {
  const rectangle = t1().levels[0].outline
  const lShape = t3().levels[0].outline

  it('spans a rectangle, for interior lines and lines on the outline edge', () => {
    expect(crossSection(rectangle, 'Y', 40)).toEqual([0, 50])
    expect(crossSection(rectangle, 'Y', 0)).toEqual([0, 50])
    expect(crossSection(rectangle, 'X', 50)).toEqual([0, 100])
  })

  it('takes the larger side where an L-shape steps', () => {
    expect(crossSection(lShape, 'Y', 30)).toEqual([0, 50])
    expect(crossSection(lShape, 'Y', 45)).toEqual([0, 25])
    expect(crossSection(lShape, 'X', 25)).toEqual([0, 60])
    expect(crossSection(lShape, 'X', 40)).toEqual([0, 30])
  })

  it('returns null when the line misses the outline', () => {
    expect(crossSection(rectangle, 'Y', 120)).toBeNull()
    expect(crossSection(lShape, 'X', -5)).toBeNull()
  })
})
