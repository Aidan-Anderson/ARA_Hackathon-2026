// Sanity checks so a typo in a fixture shows up here, not as a confusing engine failure.

import { describe, expect, it } from 'vitest'
import type { Point } from '../project'
import { allFixtures } from '.'

function signedArea(outline: Point[]): number {
  let twice = 0
  outline.forEach((a, i) => {
    const b = outline[(i + 1) % outline.length]
    twice += a.x * b.y - b.x * a.y
  })
  return twice / 2
}

describe.each(Object.entries(allFixtures))('%s', (_name, makeProject) => {
  const project = makeProject()

  it('has counter-clockwise outlines', () => {
    for (const level of project.levels) expect(signedArea(level.outline)).toBeGreaterThan(0)
  })

  it('has unique ids', () => {
    const ids = project.levels.flatMap((level) => [
      level.id,
      ...level.openings.map((opening) => opening.id),
      ...level.shearLines.flatMap((line) => [line.id, ...line.lateralElements.map((element) => element.id)]),
    ])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has Lateral Elements with start < end', () => {
    for (const level of project.levels)
      for (const line of level.shearLines)
        for (const element of line.lateralElements) expect(element.start).toBeLessThan(element.end)
  })

  it('returns a fresh copy each call', () => {
    expect(makeProject()).not.toBe(makeProject())
    expect(makeProject().loads.windPlf).not.toBe(makeProject().loads.windPlf)
  })
})

describe('fixture areas', () => {
  it('match docs/spec.md §7.2 (gross outline area)', () => {
    expect(signedArea(allFixtures.T1().levels[0].outline)).toBe(5000)
    expect(signedArea(allFixtures.T3().levels[0].outline)).toBe(2250)
  })
})
