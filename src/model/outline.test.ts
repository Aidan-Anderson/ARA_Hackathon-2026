import { describe, expect, it } from 'vitest'
import { t1, t3, t6 } from './fixtures'
import { checkOutline } from './outline'
import type { Point } from './project'

const pts = (...coords: [number, number][]): Point[] => coords.map(([x, y]) => ({ x, y }))

describe('checkOutline', () => {
  it('accepts a rectangle, an L, a T, and a +', () => {
    expect(checkOutline(t1().levels[0].outline)).toEqual({ ok: true })
    expect(checkOutline(t3().levels[0].outline)).toEqual({ ok: true })
    const tee = pts([0, 20], [10, 20], [10, 0], [20, 0], [20, 20], [30, 20], [30, 30], [0, 30])
    expect(checkOutline(tee)).toEqual({ ok: true })
    const plus = pts([10, 0], [20, 0], [20, 10], [30, 10], [30, 20], [20, 20], [20, 30], [10, 30], [10, 20], [0, 20], [0, 10], [10, 10])
    expect(checkOutline(plus)).toEqual({ ok: true })
  })

  it('accepts clockwise outlines (orientation is the drawing tool’s job)', () => {
    expect(checkOutline([...t1().levels[0].outline].reverse())).toEqual({ ok: true })
  })

  it('rejects a U (T6): a horizontal cut crosses it twice', () => {
    const check = checkOutline(t6().levels[0].outline)
    expect(check.ok).toBe(false)
    expect(!check.ok && check.message).toMatch(/not supported/)
  })

  it('rejects slanted edges, repeated corners, too few corners, and self-crossing', () => {
    expect(checkOutline(pts([0, 0], [10, 0], [5, 10])).ok).toBe(false)
    expect(checkOutline(pts([0, 0], [10, 0], [10, 10], [5, 12], [0, 10])).ok).toBe(false)
    expect(checkOutline(pts([0, 0], [10, 0], [10, 0], [10, 10], [0, 10])).ok).toBe(false)
    // An orthogonal figure-8: every cut passes single intervals, but two edges cross at (10, 0).
    const crossing = checkOutline(pts([0, 0], [20, 0], [20, 10], [10, 10], [10, -10], [0, -10]))
    expect(crossing).toEqual({ ok: false, message: 'The outline crosses or touches itself.' })
  })
})
