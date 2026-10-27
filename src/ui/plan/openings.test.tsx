import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { analyze } from '../../engine/analyze'
import { t1, t4 } from '../../model/fixtures'
import { plainHtml, viewProps } from '../panels/testProps'
import { addOpening, removeItem } from './edit'
import { hitTest } from './hitTest'
import { PlanView } from './PlanView'

const bounds = { xMin: 0, xMax: 100, yMin: 0, yMax: 50 }

/** T4 before its Opening is drawn. */
function t4Blank() {
  const project = t4()
  project.levels[0].openings = []
  return project
}

describe('Openings (B2.2)', () => {
  it('drawing the T4 Opening (x 10–20, y 20–30) gives net area 4900 and reactions 24.15 / 24.85', () => {
    const project = addOpening(t4Blank(), 'roof', { x: 10, y: 20 }, { x: 20, y: 30 })
    const results = analyze(project)
    const level = results.cases.SY.levels[0]
    expect(level.netArea).toBeCloseTo(4900, 6)
    expect(level.lines.map((line) => line.reactionFx)).toEqual([expect.closeTo(24.15, 6), expect.closeTo(24.85, 6)])
    expect(results.warnings.map((w) => w.code)).toContain('opening-chords')
  })

  it('accepts the rectangle dragged in any direction', () => {
    const opening = addOpening(t4Blank(), 'roof', { x: 20, y: 30 }, { x: 10, y: 20 }).levels[0].openings[0]
    expect(opening).toMatchObject({ xMin: 10, yMin: 20, xMax: 20, yMax: 30 })
  })

  it('clips an Opening dragged past the outline to its bounding box', () => {
    const opening = addOpening(t4Blank(), 'roof', { x: 90, y: 40 }, { x: 120, y: 70 }).levels[0].openings[0]
    expect(opening).toMatchObject({ xMin: 90, yMin: 40, xMax: 100, yMax: 50 })
  })

  it('ignores a click without a drag, or a rectangle outside the outline', () => {
    expect(addOpening(t4Blank(), 'roof', { x: 10, y: 10 }, { x: 10, y: 10 }).levels[0].openings).toEqual([])
    expect(addOpening(t4Blank(), 'roof', { x: 150, y: 10 }, { x: 160, y: 20 }).levels[0].openings).toEqual([])
  })
})

describe('hitTest and removeItem (B2.2)', () => {
  it('picks a Lateral Element over its Shear Line, a line near it, an Opening inside it, else nothing', () => {
    const level = t4().levels[0]
    expect(hitTest(level, bounds, { x: 0.5, y: 25 }, 1)).toEqual({ kind: 'lateralElement', lineId: 'roof-1', id: 'roof-1-e1' })
    const noWalls = { ...level, shearLines: level.shearLines.map((line) => ({ ...line, lateralElements: [] })) }
    expect(hitTest(noWalls, bounds, { x: 0.5, y: 25 }, 1)).toEqual({ kind: 'shearLine', id: 'roof-1' })
    expect(hitTest(level, bounds, { x: 15, y: 25 }, 1)).toEqual({ kind: 'opening', id: 'roof-o1' })
    expect(hitTest(level, bounds, { x: 50, y: 25 }, 1)).toBeNull()
  })

  it('removes an Opening, a Lateral Element, or a Shear Line', () => {
    expect(removeItem(t4(), 'roof', { kind: 'opening', id: 'roof-o1' }).levels[0].openings).toEqual([])
    const withoutWall = removeItem(t1(), 'roof', { kind: 'lateralElement', lineId: 'roof-2', id: 'roof-2-e1' })
    expect(withoutWall.levels[0].shearLines.find((l) => l.id === 'roof-2')!.lateralElements).toEqual([])
    const withoutLine = removeItem(t1(), 'roof', { kind: 'shearLine', id: 'roof-2' })
    expect(withoutLine.levels[0].shearLines.map((l) => l.name)).toEqual(['1', '3', 'A', 'B'])
  })
})

describe('PlanView Openings (B2.2)', () => {
  it('draws Openings hatched, and highlights the selected one', () => {
    const html = plainHtml(renderToString(<PlanView {...viewProps(t4())} />))
    expect(html).toContain('id="opening-hatch"')
    expect(html).toContain('class="opening"')
    const selected = { ...viewProps(t4()), selection: { kind: 'opening', levelId: 'roof', id: 'roof-o1' } as const }
    expect(plainHtml(renderToString(<PlanView {...selected} />))).toContain('class="opening selected"')
  })
})
