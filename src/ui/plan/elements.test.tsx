import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { analyze } from '../../engine/analyze'
import { t1 } from '../../model/fixtures'
import type { Project } from '../../model/project'
import { DEFAULT_EDITOR } from '../../model/ui'
import { plainHtml, viewProps } from '../panels/testProps'
import { addElement, moveShearLine, removeItem, resizeElement } from './edit'
import { gridlines } from './grid'
import { PlanView } from './PlanView'
import { snapAlong } from './snap'
import { Toolbar } from './Toolbar'

const line2 = (project: Project) => project.levels[0].shearLines.find((line) => line.id === 'roof-2')!
const reactions = (project: Project) => analyze(project).cases.SY.levels[0].lines.map((line) => line.reactionFx)

describe('Lateral Elements (B3.1)', () => {
  it('T1 → delete line 2’s wall, drag a new one from y 15 to 35 → Collector 4.68 k (T1b)', () => {
    let project = removeItem(t1(), 'roof', { kind: 'lateralElement', lineId: 'roof-2', id: 'roof-2-e1' })
    project = addElement(project, 'roof', 'roof-2', 15, 35, 'shearWall')
    const line = analyze(project).cases.SY.levels[0].lines.find((l) => l.lineId === 'roof-2')!
    expect(line.collector.maxForce).toBeCloseTo(4.68, 6)
  })

  it('accepts a drag in either direction and keeps the chosen kind', () => {
    const element = line2(addElement(t1(), 'roof', 'roof-2', 35, 15, 'bracedFrame')).lateralElements[1]
    expect(element).toMatchObject({ kind: 'bracedFrame', start: 15, end: 35 })
  })

  it('clamps to the line’s length and ignores a click without a drag', () => {
    expect(line2(addElement(t1(), 'roof', 'roof-2', -5, 60, 'shearWall')).lateralElements[1]).toMatchObject({ start: 0, end: 50 })
    expect(line2(addElement(t1(), 'roof', 'roof-2', 20, 20, 'shearWall')).lateralElements).toHaveLength(1)
  })

  it('snaps along the line: y on a Y-line, x on an X-line', () => {
    const ctx = { mode: 'draw' as const, vertices: [], gridlines: [], tolerance: 1 }
    expect(snapAlong('Y', { x: 40.3, y: 14.6 }, ctx)).toBe(15)
    expect(snapAlong('X', { x: 22.4, y: 0.2 }, ctx)).toBe(22)
  })
})

describe('moving a Shear Line (B3.1)', () => {
  it('moving line 2 from x = 40 to 50 changes the reactions to 6.5 / 13.0 / 6.5', () => {
    expect(reactions(t1())).toEqual([expect.closeTo(5.2, 6), expect.closeTo(13.0, 6), expect.closeTo(7.8, 6)])
    const moved = moveShearLine(t1(), 'roof', 'roof-2', 50)
    expect(line2(moved).position).toBe(50)
    expect(line2(moved).name).toBe('2') // keeps its name off the Grid
    expect(reactions(moved)).toEqual([expect.closeTo(6.5, 6), expect.closeTo(13.0, 6), expect.closeTo(6.5, 6)])
  })

  it('takes the Gridline’s name when it lands on one', () => {
    const project = { ...t1(), grid: { xSpacings: [40, 10, 50], ySpacings: [50] } } // Gridline 3 at x = 50
    expect(line2(moveShearLine(project, 'roof', 'roof-2', 50, gridlines(project.grid))).name).toBe('3')
  })
})

describe('Element tool UI (B3.1)', () => {
  it('shows the Element tool, and the Kind toggle while it’s active', () => {
    const toolbar = (tool: 'select' | 'element') =>
      plainHtml(renderToString(<Toolbar {...{ ...viewProps(t1()), editor: { ...DEFAULT_EDITOR, tool } }} />))
    expect(toolbar('select')).toContain('>Element<')
    expect(toolbar('select')).not.toContain('aria-label="Kind"')
    expect(toolbar('element')).toContain('aria-label="Kind"')
    expect(toolbar('element')).toContain('>Braced frame<')
  })

  it('explains the Element tool and that Select moves lines', () => {
    const plan = (tool: 'select' | 'element') =>
      plainHtml(renderToString(<PlanView {...{ ...viewProps(t1()), editor: { ...DEFAULT_EDITOR, tool } }} />))
    expect(plan('element')).toContain('Drag along a Shear Line to add a shear wall')
    expect(plan('select')).toContain('drag a Shear Line to move it')
  })
})

describe('resizing Lateral Elements (follow-up)', () => {
  it('drags either end, clamped to the line and to a minimum length', () => {
    const resize = (end: 'start' | 'end', value: number) =>
      line2(resizeElement(t1(), 'roof', 'roof-2', 'roof-2-e1', end, value, [0, 50])).lateralElements[0]
    expect(resize('end', 28)).toMatchObject({ start: 0, end: 28 })
    expect(resize('end', 80)).toMatchObject({ end: 50 }) // clamped to the 50 ft line
    expect(resize('start', 15)).toMatchObject({ start: 15, end: 20 })
    expect(resize('start', 25)).toMatchObject({ start: 19.5, end: 20 }) // keeps 0.5 ft minimum
  })

  it('resizing line 2’s wall from 0–20 to 15–35 (two drags) gives the T1b Collector 4.68 k', () => {
    let project = resizeElement(t1(), 'roof', 'roof-2', 'roof-2-e1', 'end', 35, [0, 50])
    project = resizeElement(project, 'roof', 'roof-2', 'roof-2-e1', 'start', 15, [0, 50])
    const line = analyze(project).cases.SY.levels[0].lines.find((l) => l.lineId === 'roof-2')!
    expect(line.collector.maxForce).toBeCloseTo(4.68, 6)
  })

  it('shows handles at the ends of the selected wall, with a hint', () => {
    const props = {
      ...viewProps(t1()),
      selection: { kind: 'lateralElement', levelId: 'roof', lineId: 'roof-2', id: 'roof-2-e1' } as const,
    }
    const html = plainHtml(renderToString(<PlanView {...props} />))
    expect(html.split('class="handle"').length - 1).toBe(2)
    expect(html).toContain('Drag a square handle to resize the wall or frame')
  })
})
