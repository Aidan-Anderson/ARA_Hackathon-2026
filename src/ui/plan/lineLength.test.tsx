// Changing a Shear Line's length on the plan (ADR 0002).

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { t1 } from '../../model/fixtures'
import type { Project } from '../../model/project'
import { parseProjectFile, serializeProject } from '../io/saveLoad'
import { DetailPanel } from '../panels/DetailPanel'
import { ResultsPanel } from '../panels/ResultsPanel'
import { plainHtml, viewProps } from '../panels/testProps'
import { resetLineLength, setLineEnd } from './edit'
import { PlanView } from './PlanView'

const line = (project: Project, name: string) => project.levels[0].shearLines.find((l) => l.name === name)!
const line2Short = () => setLineEnd(t1(), 'roof', 'roof-2', 'end', 20)
const selectLine2 = (project: Project) =>
  ({ ...viewProps(project), selection: { kind: 'shearLine', levelId: 'roof', id: 'roof-2' } }) as const

describe('setLineEnd / resetLineLength', () => {
  it('shortens a line by moving one end', () => {
    expect(line(line2Short(), '2').extent).toEqual({ start: 0, end: 20 })
  })

  it('trims the line’s walls to the new length, and drops any left too short', () => {
    const shortened = setLineEnd(t1(), 'roof', 'roof-1', 'end', 30)
    expect(line(shortened, '1').lateralElements[0]).toMatchObject({ start: 0, end: 30 })
    const pastWall = setLineEnd(line2Short(), 'roof', 'roof-2', 'start', 20)
    expect(line(pastWall, '2').lateralElements).toHaveLength(1) // wall 0–20 trimmed to 19–20 is kept (≥ 0.5 ft)
  })

  it('keeps at least 1 ft and stays inside the Diaphragm', () => {
    expect(line(setLineEnd(t1(), 'roof', 'roof-2', 'end', -10), '2').extent).toEqual({ start: 0, end: 1 })
    expect(line(setLineEnd(t1(), 'roof', 'roof-2', 'start', -10), '2').extent).toBeUndefined() // clamped to full depth
  })

  it('lengthening back to the full depth removes the extent; so does "Use full depth"', () => {
    expect(line(setLineEnd(line2Short(), 'roof', 'roof-2', 'end', 50), '2').extent).toBeUndefined()
    expect(line(resetLineLength(line2Short(), 'roof', 'roof-2'), '2').extent).toBeUndefined()
  })

  it('is saved with the project, and a bad length is rejected on load', () => {
    const parsed = parseProjectFile(serializeProject(line2Short()))
    expect(parsed.ok && line(parsed.project, '2').extent).toEqual({ start: 0, end: 20 })
    const bad = line2Short()
    line(bad, '2').extent = { start: 30, end: 10 }
    expect(parseProjectFile(serializeProject(bad))).toEqual({
      ok: false,
      error: 'This is not a Lateral Load Path project: Roof has a Shear Line with an invalid length.',
    })
  })
})

describe('line length UI', () => {
  it('shows handles at the selected line’s ends, at its shortened length', () => {
    const html = plainHtml(renderToString(<PlanView {...selectLine2(line2Short())} />))
    expect(html.split('class="handle"').length - 1).toBe(2)
    expect(html).toContain('Drag a square handle to shorten or lengthen the Shear Line')
  })

  it('Detail panel says the line is shortened and offers full depth back', () => {
    const shortHtml = plainHtml(renderToString(<DetailPanel {...selectLine2(line2Short())} />))
    expect(shortHtml).toContain('runs y 0.0–20.0 ft (20.0 ft), shortened')
    expect(shortHtml).toContain('>Use full depth<')
    const fullHtml = plainHtml(renderToString(<DetailPanel {...selectLine2(t1())} />))
    expect(fullHtml).toContain(', full depth')
    expect(fullHtml).not.toContain('Use full depth<')
  })

  it('labels each span with its strip, in the Results panel and the plan diagrams', () => {
    const results = plainHtml(renderToString(<ResultsPanel {...viewProps(line2Short())} />))
    expect(results).toContain('strip y 0–20')
    expect(results).toContain('strip y 20–50')
    const plan = plainHtml(renderToString(<PlanView {...viewProps(line2Short())} />))
    expect(plan).toContain('V (k) · strip y 0–20')
    expect(plan).toContain('M (k-ft) · strip y 20–50')
  })
})
