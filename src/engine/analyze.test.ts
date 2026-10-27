import { describe, expect, it } from 'vitest'
import { t1, t2 } from '../model/fixtures'
import type { Project } from '../model/project'
import type { LoadCaseId } from '../model/results'
import { analyze } from './analyze'

/** Line results for one Level and Load Case, keyed by Shear Line name. */
function linesByName(project: Project, caseId: LoadCaseId, levelIndex = 0) {
  const level = project.levels[levelIndex]
  const levelResult = analyze(project).cases[caseId].levels[levelIndex]
  return Object.fromEntries(
    levelResult.lines.map((line) => [level.shearLines.find((sl) => sl.id === line.lineId)!.name, line]),
  )
}

describe('analyze: shape', () => {
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

describe('analyze: Diaphragm Reactions at F_x level (A1.1)', () => {
  it('T1 SY: Level forces', () => {
    const level = analyze(t1()).cases.SY.levels[0]
    expect(level.netArea).toBeCloseTo(5000, 6)
    expect(level.fx).toBeCloseTo(26.0, 6)
    expect(level.weight).toBeCloseTo(120.0, 6)
  })

  it('T1 SY: reactions 5.2 / 13.0 / 7.8 by simple-beam statics', () => {
    const lines = linesByName(t1(), 'SY')
    expect(Object.keys(lines)).toEqual(['1', '2', '3'])
    expect(lines['1'].reactionFx).toBeCloseTo(5.2, 6)
    expect(lines['2'].reactionFx).toBeCloseTo(13.0, 6)
    expect(lines['3'].reactionFx).toBeCloseTo(7.8, 6)
  })

  it('T1 SY: line lengths and story shear (single Level, so story shear = reaction)', () => {
    const lines = linesByName(t1(), 'SY')
    for (const name of ['1', '2', '3']) {
      expect(lines[name].length).toBeCloseTo(50, 6)
      expect(lines[name].storyShear).toBeCloseTo(lines[name].reactionFx, 9)
    }
  })

  it('T1 SX: lines A and B get 13.0 each', () => {
    const lines = linesByName(t1(), 'SX')
    expect(Object.keys(lines)).toEqual(['A', 'B'])
    expect(lines.A.reactionFx).toBeCloseTo(13.0, 6)
    expect(lines.B.reactionFx).toBeCloseTo(13.0, 6)
    expect(lines.A.length).toBeCloseTo(100, 6)
  })

  it('reactions add up to F_x', () => {
    for (const caseId of ['SX', 'SY'] as const) {
      const level = analyze(t1()).cases[caseId].levels[0]
      const sum = level.lines.reduce((total, line) => total + line.reactionFx, 0)
      expect(sum).toBeCloseTo(level.fx, 6)
    }
  })

  it('T2: each Level on its own gives 6 / 15 / 9 in SY', () => {
    const project = t2()
    for (const levelIndex of [0, 1]) {
      const lines = linesByName(project, 'SY', levelIndex)
      expect(lines['1'].reactionFx).toBeCloseTo(6, 6)
      expect(lines['2'].reactionFx).toBeCloseTo(15, 6)
      expect(lines['3'].reactionFx).toBeCloseTo(9, 6)
    }
  })

  it('leaves wind cases at zero until A3.2', () => {
    const level = analyze(t1()).cases.WY.levels[0]
    expect(level.fx).toBe(0)
    expect(level.lines).toEqual([])
  })
})
