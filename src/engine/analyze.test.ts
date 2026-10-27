import { describe, expect, it } from 'vitest'
import { t1, t2, t3, t4, t6, t6b, t7 } from '../model/fixtures'
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

/** Span results for one Level and Load Case, keyed "fromName→toName". */
function spansByName(project: Project, caseId: LoadCaseId, levelIndex = 0) {
  const level = project.levels[levelIndex]
  const name = (lineId: string | null) => level.shearLines.find((sl) => sl.id === lineId)?.name ?? 'free'
  const levelResult = analyze(project).cases[caseId].levels[levelIndex]
  return Object.fromEntries(levelResult.spans.map((span) => [`${name(span.fromLineId)}→${name(span.toLineId)}`, span]))
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

describe('analyze: F_px, Diaphragm diagrams, Chords (A2.1)', () => {
  it('T1: F_px raw 26.0, min 31.2 governs, max 62.4', () => {
    const fpx = analyze(t1()).cases.SY.levels[0].fpx!
    expect(fpx.raw).toBeCloseTo(26.0, 6)
    expect(fpx.min).toBeCloseTo(31.2, 6)
    expect(fpx.max).toBeCloseTo(62.4, 6)
    expect(fpx.fpx).toBeCloseTo(31.2, 6)
    expect(fpx.design).toBeCloseTo(31.2, 6)
    expect(fpx.governs).toBe('min')
  })

  it('T1: reactions at F_px level 6.24 / 15.6 / 9.36', () => {
    const lines = linesByName(t1(), 'SY')
    expect(lines['1'].reactionFpx).toBeCloseTo(6.24, 6)
    expect(lines['2'].reactionFpx).toBeCloseTo(15.6, 6)
    expect(lines['3'].reactionFpx).toBeCloseTo(9.36, 6)
  })

  it('T1 SY spans: max V, v, M, Chord', () => {
    const spans = spansByName(t1(), 'SY')
    expect(Object.keys(spans)).toEqual(['1→2', '2→3'])
    expectSpan(spans['1→2'], { maxShear: 6.24, maxUnitShear: 124.8, maxMoment: 62.4, maxChord: 1.248 })
    expectSpan(spans['2→3'], { maxShear: 9.36, maxUnitShear: 187.2, maxMoment: 140.4, maxChord: 2.808 })
  })

  it('T1 SY: unit shear on each side of each line', () => {
    const lines = linesByName(t1(), 'SY')
    expect(lines['1'].unitShearLeft).toBe(0)
    expect(lines['1'].unitShearRight).toBeCloseTo(124.8, 6)
    expect(lines['2'].unitShearLeft).toBeCloseTo(124.8, 6)
    expect(lines['2'].unitShearRight).toBeCloseTo(187.2, 6)
    expect(lines['3'].unitShearLeft).toBeCloseTo(187.2, 6)
    expect(lines['3'].unitShearRight).toBe(0)
  })

  it('T1 SX: the span runs in y and the depth is the 100 ft width', () => {
    // F_px 31.2 k over 5000 sf → 0.624 klf along the 50 ft span between A and B.
    expectSpan(spansByName(t1(), 'SX')['A→B'], { maxShear: 15.6, maxUnitShear: 156, maxMoment: 195, maxChord: 1.95 })
  })

  it('T2 Roof: F_px 30 by the equation; spans 6.0/120/60/1.20 and 9.0/180/135/2.70', () => {
    const project = t2()
    const fpx = analyze(project).cases.SY.levels[1].fpx!
    expect(fpx.raw).toBeCloseTo(30, 6)
    expect(fpx.min).toBeCloseTo(26, 6)
    expect(fpx.max).toBeCloseTo(52, 6)
    expect(fpx.design).toBeCloseTo(30, 6)
    expect(fpx.governs).toBe('equation')
    const spans = spansByName(project, 'SY', 1)
    expectSpan(spans['1→2'], { maxShear: 6.0, maxUnitShear: 120, maxMoment: 60, maxChord: 1.2 })
    expectSpan(spans['2→3'], { maxShear: 9.0, maxUnitShear: 180, maxMoment: 135, maxChord: 2.7 })
  })

  it('T2 Level 2: F_px raw 40, min 52 governs; spans 10.4/208/104/2.08 and 15.6/312/234/4.68', () => {
    const project = t2()
    const fpx = analyze(project).cases.SY.levels[0].fpx!
    expect(fpx.raw).toBeCloseTo(40, 6)
    expect(fpx.min).toBeCloseTo(52, 6)
    expect(fpx.max).toBeCloseTo(104, 6)
    expect(fpx.design).toBeCloseTo(52, 6)
    expect(fpx.governs).toBe('min')
    const spans = spansByName(project, 'SY', 0)
    expectSpan(spans['1→2'], { maxShear: 10.4, maxUnitShear: 208, maxMoment: 104, maxChord: 2.08 })
    expectSpan(spans['2→3'], { maxShear: 15.6, maxUnitShear: 312, maxMoment: 234, maxChord: 4.68 })
  })

  it('uses F_x for the Diaphragm when it exceeds F_px', () => {
    const project = t1()
    project.levels[0].seismic.weightPsf = 0 // no weight → F_px 0, so F_x governs
    const fpx = analyze(project).cases.SY.levels[0].fpx!
    expect(fpx.design).toBeCloseTo(26.0, 6)
    expect(fpx.governs).toBe('fx')
  })

  it('diagrams: stations at most 1 ft apart, chords zero at the supports', () => {
    for (const span of analyze(t1()).cases.SY.levels[0].spans) {
      const { s, v } = span.chord
      expect(s[0]).toBe(span.start)
      expect(s[s.length - 1]).toBe(span.end)
      for (let i = 1; i < s.length; i++) expect(s[i] - s[i - 1]).toBeLessThanOrEqual(1 + 1e-9)
      expect(v[0]).toBeCloseTo(0, 9)
      expect(v[v.length - 1]).toBeCloseTo(0, 9)
      expect(span.shear.s).toEqual(s)
    }
  })
})

describe('analyze: L/T shapes, Re-entrant Corners, Openings, Overhangs (A2.2)', () => {
  it('T3 L-shape: simple-beam reactions 13.125 / 9.375 (tributary area would give 15.0 / 7.5)', () => {
    const lines = linesByName(t3(), 'SY')
    expect(lines['1'].reactionFx).toBeCloseTo(13.125, 6)
    expect(lines['3'].reactionFx).toBeCloseTo(9.375, 6)
    expect(lines['1'].length).toBeCloseTo(50, 6)
    expect(lines['3'].length).toBeCloseTo(25, 6)
    expect(lines['3'].unitShearLeft).toBeCloseTo(375, 6)
  })

  it('T3 L-shape: max moment 172.27, Chord 6.75 on the narrow side, Re-entrant Corner 6.75 at (30, 25)', () => {
    const level = analyze(t3()).cases.SY.levels[0]
    const span = level.spans[0]
    expect(level.spans).toHaveLength(1)
    expect(span.maxMoment).toBeCloseTo(172.265625, 6)
    expect(span.maxChord).toBeCloseTo(6.75, 6)
    expect(span.maxUnitShear).toBeCloseTo(375, 6)
    expect(level.corners).toEqual([{ s: 30, point: { x: 30, y: 25 }, force: expect.closeTo(6.75, 6) }])
  })

  it('T3 L-shape in X: the corner is found from the other side too', () => {
    const level = analyze(t3()).cases.SX.levels[0]
    expect(level.corners.map((corner) => corner.point)).toEqual([{ x: 30, y: 25 }])
  })

  it('T4 Opening: net area 4900, reactions 24.15 / 24.85', () => {
    const level = analyze(t4()).cases.SY.levels[0]
    expect(level.netArea).toBeCloseTo(4900, 6)
    expect(level.fx).toBeCloseTo(49.0, 6)
    const lines = linesByName(t4(), 'SY')
    expect(lines['1'].reactionFx).toBeCloseTo(24.15, 6)
    expect(lines['2'].reactionFx).toBeCloseTo(24.85, 6)
  })

  it('T4 Opening: at s = 15, V 17.15 k, unit shear on net depth 428.75 plf, Chord on gross depth 6.145 k', () => {
    const span = analyze(t4()).cases.SY.levels[0].spans[0]
    const at = (diagram: { s: number[]; v: number[] }) => diagram.v[diagram.s.indexOf(15)]
    expect(Math.abs(at(span.shear))).toBeCloseTo(17.15, 6)
    expect(at(span.unitShear)).toBeCloseTo(428.75, 6)
    expect(at(span.chord)).toBeCloseTo(6.145, 6)
  })

  it('T4 Opening: warns that chord forces around Openings are not calculated', () => {
    expect(analyze(t4()).warnings.map((w) => w.code)).toContain('opening-chords')
  })

  it('T6 U outline: outline-invalid, and the Level has no results', () => {
    const results = analyze(t6())
    expect(results.warnings).toEqual([expect.objectContaining({ severity: 'error', code: 'outline-invalid', levelId: 'roof' })])
    expect(results.cases.SY.levels[0].lines).toEqual([])
    expect(results.cases.SY.levels[0].fx).toBe(0)
  })

  it('T6b one Y line: too-few-lines once (not per Load Case), and no SY spans', () => {
    const results = analyze(t6b())
    const tooFew = results.warnings.filter((w) => w.code === 'too-few-lines')
    expect(tooFew).toHaveLength(1)
    expect(tooFew[0].message).toMatch(/in Y/)
    expect(results.cases.SY.levels[0].spans).toEqual([])
    expect(results.cases.SX.levels[0].spans).toHaveLength(1) // X still works
  })

  it('T7 Overhang: reactions 22.5 / 27.5; cantilever M 25.0 and Chord 0.5; overhang-long', () => {
    const project = t7()
    const lines = linesByName(project, 'SY')
    expect(lines['1'].reactionFx).toBeCloseTo(22.5, 6)
    expect(lines['2'].reactionFx).toBeCloseTo(27.5, 6)

    const results = analyze(project)
    const overhang = results.cases.SY.levels[0].spans.find((span) => span.kind === 'overhang')!
    expect(overhang.fromLineId).toBe('roof-2')
    expect(overhang.toLineId).toBeNull()
    expect(overhang.maxMoment).toBeCloseTo(25.0, 6)
    expect(overhang.maxChord).toBeCloseTo(0.5, 6)
    expect(results.warnings).toEqual([expect.objectContaining({ code: 'overhang-long', refId: 'roof-2' })])
  })

  it('reactions still add up to F_x with Openings and Overhangs', () => {
    for (const project of [t3(), t4(), t7()]) {
      for (const caseId of ['SX', 'SY'] as const) {
        const level = analyze(project).cases[caseId].levels[0]
        const sum = level.lines.reduce((total, line) => total + line.reactionFx, 0)
        expect(sum).toBeCloseTo(level.fx, 6)
      }
    }
  })

  it('T1 and T2 raise no warnings', () => {
    expect(analyze(t1()).warnings).toEqual([])
    expect(analyze(t2()).warnings).toEqual([])
  })
})

function expectSpan(
  span: { maxShear: number; maxUnitShear: number; maxMoment: number; maxChord: number },
  expected: { maxShear: number; maxUnitShear: number; maxMoment: number; maxChord: number },
) {
  expect(span.maxShear).toBeCloseTo(expected.maxShear, 6)
  expect(span.maxUnitShear).toBeCloseTo(expected.maxUnitShear, 6)
  expect(span.maxMoment).toBeCloseTo(expected.maxMoment, 6)
  expect(span.maxChord).toBeCloseTo(expected.maxChord, 6)
}
