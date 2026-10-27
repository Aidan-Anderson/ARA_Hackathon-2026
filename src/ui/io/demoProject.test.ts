// D.1: the committed demo project loads and shows what the demo script walks through.

import { describe, expect, it } from 'vitest'
import demoText from '../../../demo/demo-project.json?raw'
import { analyze } from '../../engine/analyze'
import { parseProjectFile } from './saveLoad'

describe('demo/demo-project.json (D.1)', () => {
  const parsed = parseProjectFile(demoText)
  if (!parsed.ok) throw new Error(`demo project does not load: ${parsed.error}`)
  const project = parsed.project
  const results = analyze(project)

  it('loads as a 2-Level L-shape with an Opening and no errors', () => {
    expect(project.levels.map((l) => l.name)).toEqual(['Level 2', 'Roof'])
    expect(project.levels[0].openings).toHaveLength(1)
    expect(results.warnings.filter((w) => w.severity === 'error')).toEqual([])
  })

  it('has a Re-entrant Corner on each Level', () => {
    for (const level of results.cases.SY.levels) expect(level.corners.length).toBeGreaterThan(0)
  })

  it('the Roof’s line 3 stops, so Level 2 gets a Transfer Force at x = 60', () => {
    const roofLine3 = results.cases.SY.levels[1].lines.find((l) => l.lineId === 'roof-3')!
    expect(roofLine3.continuesBelow).toBe(false)
    const [transfer] = results.cases.SY.levels[0].transfersIn
    expect(transfer.fromLineId).toBe('roof-3')
    expect(transfer.position).toBe(60)
    expect(transfer.force).toBeGreaterThan(0)
  })
})
