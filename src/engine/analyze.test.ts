import { describe, expect, it } from 'vitest'
import { t2 } from '../model/fixtures'
import { analyze } from './analyze'

describe('analyze (P0.2 stub shape)', () => {
  it('returns every Load Case with one LevelResult per Level, in order', () => {
    const project = t2()
    const results = analyze(project)

    expect(Object.keys(results.cases).sort()).toEqual(['SX', 'SY', 'WX', 'WY'])
    expect(results.cases.SY.direction).toBe('Y')
    expect(results.cases.SX.asdFactor).toBe(0.7)
    expect(results.cases.WY.asdFactor).toBe(0.6)
    expect(results.cases.SY.levels.map((level) => level.levelId)).toEqual(project.levels.map((level) => level.id))
  })
})
