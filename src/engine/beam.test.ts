import { describe, expect, it } from 'vitest'
import { cantilever, simpleBeam } from './beam'
import { maxAbs } from './math'

describe('simpleBeam', () => {
  it('splits a uniform load equally: wL/2 each end, wL²/8 at midspan', () => {
    const beam = simpleBeam(0, 60, { uniform: [{ from: 0, to: 60, w: 0.5 }], points: [] })
    expect(beam.rStart).toBeCloseTo(15, 6)
    expect(beam.rEnd).toBeCloseTo(15, 6)
    expect(beam.momentAt(30)).toBeCloseTo(225, 6)
    expect(beam.shearAt(60, 'left')).toBeCloseTo(-15, 6)
  })

  it('works on a span that does not start at zero (T1 span 2→3 at F_px level)', () => {
    const beam = simpleBeam(40, 100, { uniform: [{ from: 0, to: 100, w: 0.312 }], points: [] })
    expect(beam.rStart).toBeCloseTo(9.36, 6)
    expect(beam.rEnd).toBeCloseTo(9.36, 6)
    expect(beam.momentAt(70)).toBeCloseTo(140.4, 6)
  })

  it('gives the ADR 0001 reactions for a span that changes depth, not the tributary ones', () => {
    // 10 psf on 50 ft depth for 30 ft, then 25 ft depth for 30 ft.
    const beam = simpleBeam(0, 60, {
      uniform: [
        { from: 0, to: 30, w: 0.5 },
        { from: 30, to: 60, w: 0.25 },
      ],
      points: [],
    })
    expect(beam.rStart).toBeCloseTo(13.125, 6)
    expect(beam.rEnd).toBeCloseTo(9.375, 6)

    const { s, moment } = beam.stations()
    expect(s).toContain(26.25) // exact zero-shear point
    expect(maxAbs(moment)).toBeCloseTo(172.265625, 6)
    expect(beam.momentAt(30)).toBeCloseTo(168.75, 6)
  })

  it('handles a point load with a shear jump (T5 Level 2 at F_px level)', () => {
    const beam = simpleBeam(0, 100, { uniform: [{ from: 0, to: 100, w: 0.52 }], points: [{ at: 40, p: 15 }] })
    expect(beam.rStart).toBeCloseTo(35, 6)
    expect(beam.rEnd).toBeCloseTo(32, 6)
    expect(beam.shearAt(40, 'left')).toBeCloseTo(14.2, 6)
    expect(beam.shearAt(40, 'right')).toBeCloseTo(-0.8, 6)

    const { s, shear, moment } = beam.stations()
    const at40 = s.flatMap((value, i) => (value === 40 ? [shear[i]] : []))
    expect(at40).toHaveLength(2) // left value, then right value
    expect(at40[0]).toBeCloseTo(14.2, 6)
    expect(at40[1]).toBeCloseTo(-0.8, 6)
    expect(maxAbs(moment)).toBeCloseTo(984, 6)
  })

  it('cantilevers put all load on the support, with zero shear and moment at the free end (T7)', () => {
    const loads = { uniform: [{ from: 0, to: 100, w: 0.5 }], points: [] }
    const right = cantilever(90, 100, loads, 'start') // Overhang past the last line
    expect(right.rStart).toBeCloseTo(5, 6)
    expect(right.rEnd).toBe(0)
    expect(right.shearAt(90, 'right')).toBeCloseTo(5, 6)
    expect(right.momentAt(90)).toBeCloseTo(-25, 6)
    expect(right.shearAt(100, 'left')).toBeCloseTo(0, 9)
    expect(right.momentAt(100)).toBeCloseTo(0, 9)

    const left = cantilever(0, 10, loads, 'end') // Overhang before the first line at s = 10
    expect(left.rStart).toBe(0)
    expect(left.rEnd).toBeCloseTo(5, 6)
    expect(left.momentAt(0)).toBe(0)
    expect(left.momentAt(10)).toBeCloseTo(-25, 6)
  })

  it('spaces stations at most maxStep apart and ends at both supports', () => {
    const { s, moment } = simpleBeam(0, 40, { uniform: [{ from: 0, to: 40, w: 0.312 }], points: [] }).stations(1)
    expect(s[0]).toBe(0)
    expect(s[s.length - 1]).toBe(40)
    for (let i = 1; i < s.length; i++) expect(s[i] - s[i - 1]).toBeLessThanOrEqual(1 + 1e-9)
    expect(moment[0]).toBeCloseTo(0, 9)
    expect(moment[moment.length - 1]).toBeCloseTo(0, 9)
    expect(maxAbs(moment)).toBeCloseTo(62.4, 6)
  })
})
