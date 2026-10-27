import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { t1, t3, t6 } from '../../model/fixtures'
import type { Project } from '../../model/project'
import { DEFAULT_EDITOR, type EditorState } from '../../model/ui'
import { plainHtml, viewProps } from '../panels/testProps'
import { PlanView } from './PlanView'
import { Toolbar } from './Toolbar'

function render(project: Project, editor: Partial<EditorState> = {}): string {
  const props = { ...viewProps(project), editor: { ...DEFAULT_EDITOR, ...editor } }
  return plainHtml(renderToString(<PlanView {...props} />))
}

const count = (html: string, needle: string) => html.split(needle).length - 1

describe('PlanView', () => {
  it('draws T1: Gridline bubbles 1, 2, 3, A, B, the outline, 5 Shear Lines, 5 Lateral Elements', () => {
    const html = render(t1())
    expect(count(html, 'class="gridline"')).toBe(5)
    for (const label of ['>1<', '>2<', '>3<', '>A<', '>B<']) expect(html).toContain(label)
    expect(count(html, 'class="outline"')).toBe(1)
    expect(count(html, 'class="shear-line"')).toBe(5)
    expect(count(html, 'class="element shearWall"')).toBe(5)
  })

  it('draws the L-shape’s six corners', () => {
    const points = render(t3()).match(/class="outline" points="([^"]+)"/)![1]
    expect(points.split(' ')).toHaveLength(6)
  })

  it('highlights the selected Shear Line', () => {
    const props = { ...viewProps(t1()), selection: { kind: 'shearLine', levelId: 'roof', id: 'roof-2' } as const }
    expect(plainHtml(renderToString(<PlanView {...props} />))).toContain('class="shear-line selected"')
  })

  it('tells the user what the tool does', () => {
    expect(render(t1(), { tool: 'shearLine' })).toContain('Click a Gridline to add a Shear Line')
  })
})

describe('PlanView drawing (B2.1)', () => {
  it('warns on the plan when the outline is not supported (T6 U-shape)', () => {
    const html = render(t6())
    expect(html).toContain('class="plan-banner"')
    expect(html).toContain('not supported')
    expect(html).toContain('Roof has no results until the outline is fixed')
  })

  it('has no banner for a valid outline', () => {
    expect(render(t3())).not.toContain('plan-banner')
  })

  it('explains the Outline tool and the draw-mode Shear Line tool', () => {
    expect(render(t1(), { tool: 'outline' })).toContain('Click the first corner of the outline')
    expect(render(t1(), { mode: 'draw', tool: 'shearLine', lineDirection: 'X' })).toContain('Click to add a Shear Line in X')
  })
})

describe('Toolbar', () => {
  it('offers the modes and tools, with modes that aren’t built yet disabled', () => {
    const html = plainHtml(renderToString(<Toolbar {...viewProps(t1())} />))
    expect(html).toContain('aria-pressed="true">Grid<')
    expect(html).toContain('aria-pressed="false">Draw<')
    expect(html).toContain('disabled="" aria-pressed="false">Import<')
    expect(html).toContain('>Outline<')
    expect(html).toContain('>Shear Line<')
  })

  it('shows the X/Y direction for Shear Lines in draw mode only', () => {
    const toolbar = (editor: Partial<EditorState>) =>
      plainHtml(renderToString(<Toolbar {...{ ...viewProps(t1()), editor: { ...DEFAULT_EDITOR, ...editor } }} />))
    expect(toolbar({ mode: 'draw', tool: 'shearLine' })).toContain('aria-label="Direction"')
    expect(toolbar({ mode: 'grid', tool: 'shearLine' })).not.toContain('aria-label="Direction"')
  })
})
