// Shortened Shear Lines and Diaphragm strips (ADR 0002), hand-checked on T1.

import { describe, expect, it } from 'vitest'
import { t1, t1w } from '../model/fixtures'
import type { Project } from '../model/project'
import { analyze } from './analyze'

/** T1 with Shear Lines shortened: { lineName: [start, end] }. */
function shortened(project: Project, extents: Record<string, [number, number]>): Project {
  for (const line of project.levels[0].shearLines) {
    const extent = extents[line.name]
    if (extent) line.extent = { start: extent[0], end: extent[1] }
  }
  return project
}

const byName = (project: Project, caseId: 'SY' | 'SX' | 'WY' = 'SY') => {
  const results = analyze(project)
  const names = new Map(project.levels[0].shearLines.map((l) => [l.id, l.name]))
  return Object.fromEntries(results.cases[caseId].levels[0].lines.map((l) => [names.get(l.lineId)!, l]))
}

describe('shortened Shear Lines (ADR 0002)', () => {
  // Line 2 at x = 40 now runs y 0–20 only (its wall is already 0–20).
  const line2Short = () => shortened(t1(), { '2': [0, 20] })

  it('splits the Diaphragm into strips: line 2 carries only the lower strip', () => {
    // Strip y 0–20 (0.104 klf): 2.08 / 5.20 / 3.12. Strip y 20–50 (0.156 klf), lines 1 and 3 only: 7.80 / 7.80.
    const lines = byName(line2Short())
    expect(lines['1'].reactionFx).toBeCloseTo(9.88, 6)
    expect(lines['2'].reactionFx).toBeCloseTo(5.2, 6)
    expect(lines['3'].reactionFx).toBeCloseTo(10.92, 6)
    expect(lines['1'].reactionFx + lines['2'].reactionFx + lines['3'].reactionFx).toBeCloseTo(26, 6)
    expect(lines['2'].length).toBeCloseTo(20, 6)
  })

  it('reports each strip’s spans, tagged with the strip', () => {
    const spans = analyze(line2Short()).cases.SY.levels[0].spans
    expect(spans.map((s) => [s.band, s.start, s.end])).toEqual([
      [{ from: 0, to: 20 }, 0, 40],
      [{ from: 0, to: 20 }, 40, 100],
      [{ from: 20, to: 50 }, 0, 100],
    ])
    // F_px 31.2 k over 5000 sf = 0.00624 ksf. Upper strip: 0.1872 klf over 100 ft → M 234, Chord 234 / 30.
    expect(spans[2].maxMoment).toBeCloseTo(234, 6)
    expect(spans[2].maxChord).toBeCloseTo(7.8, 6)
    // Lower strip, span 1→2: 0.1248 klf over 40 ft → M 24.96, Chord 24.96 / 20.
    expect(spans[0].maxChord).toBeCloseTo(1.248, 6)
  })

  it('gives line 2 its unit shear over its own 20 ft', () => {
    const lines = byName(line2Short())
    expect(lines['2'].unitShearLeft).toBeCloseTo(124.8, 6)
    expect(lines['2'].unitShearRight).toBeCloseTo(187.2, 6)
  })

  it('leaves the other direction alone', () => {
    const lines = byName(line2Short(), 'SX')
    expect(lines.A.reactionFx).toBeCloseTo(13, 6)
    expect(lines.B.reactionFx).toBeCloseTo(13, 6)
  })

  it('splits wind by each strip’s share of the depth (T1w, 300 plf)', () => {
    // Strip 0–20 gets 0.12 klf: 2.4 / 6.0 / 3.6. Strip 20–50 gets 0.18 klf: 9.0 / 9.0.
    const lines = byName(shortened(t1w(), { '2': [0, 20] }), 'WY')
    expect(lines['1'].reactionFx).toBeCloseTo(11.4, 6)
    expect(lines['2'].reactionFx).toBeCloseTo(6.0, 6)
    expect(lines['3'].reactionFx).toBeCloseTo(12.6, 6)
  })

  it('a line lengthened back to the full depth behaves exactly like T1', () => {
    expect(analyze(shortened(t1(), { '2': [0, 50] }))).toEqual(analyze(t1()))
  })

  it('warns when no line covers a strip, and that strip’s load is lost', () => {
    const project = shortened(t1(), { '1': [0, 20], '2': [0, 20], '3': [0, 20] })
    const results = analyze(project)
    expect(results.warnings).toContainEqual(
      expect.objectContaining({ severity: 'error', code: 'unsupported-strip', levelId: 'roof' }),
    )
    const total = results.cases.SY.levels[0].lines.reduce((sum, l) => sum + l.reactionFx, 0)
    expect(total).toBeCloseTo(26 * (20 / 50), 6) // only the covered strip y 0–20 is carried
  })

  it('tags Envelope span entries with their strip', () => {
    const refs = analyze(line2Short()).envelope.filter((e) => e.kind === 'span').map((e) => e.refId)
    expect(refs).toContain('roof-1→roof-3@20-50')
  })
})
