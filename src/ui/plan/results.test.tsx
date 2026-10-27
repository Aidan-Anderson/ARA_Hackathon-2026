import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { analyze } from '../../engine/analyze'
import { t1, t1w, t5 } from '../../model/fixtures'
import type { Project } from '../../model/project'
import { DEFAULT_EDITOR, type CaseView, type EditorState } from '../../model/ui'
import { plainHtml, viewProps } from '../panels/testProps'
import { PlanView } from './PlanView'
import { COLLECTOR_DIAGRAM_FT, collectorPolygon, kips, utilizationColor } from './resultsGeometry'
import { Toolbar } from './Toolbar'

function plan(
  project: Project,
  { caseId = 'SY', showAsd = false, levelId, layers }: { caseId?: CaseView; showAsd?: boolean; levelId?: string; layers?: Partial<EditorState['layers']> } = {},
): string {
  const props = viewProps(project, caseId, levelId)
  const editor = { ...DEFAULT_EDITOR, layers: { ...DEFAULT_EDITOR.layers, ...layers } }
  return plainHtml(renderToString(<PlanView {...{ ...props, showAsd, editor }} />))
}

describe('results helpers (B3.2)', () => {
  it('formats kips to 3 significant figures', () => {
    expect([9.36, 13, 140.4, 0.5].map(kips)).toEqual(['9.36', '13.0', '140', '0.50'])
  })

  it('colors Lateral Elements from light purple (low plf) to red (highest)', () => {
    expect(utilizationColor(0)).toBe('rgb(196 177 245)')
    expect(utilizationColor(1)).toBe('rgb(207 34 46)')
  })

  it('T1 line 2: the Collector diagram peaks at the wall end, y = 20, scaled to 8 ft', () => {
    const line = analyze(t1()).cases.SY.levels[0].lines.find((l) => l.lineId === 'roof-2')!
    const polygon = collectorPolygon({ direction: 'Y', position: 40 }, line.collector.force, COLLECTOR_DIAGRAM_FT / 9.36)
    expect(polygon[0]).toEqual({ x: 40, y: 0 })
    expect(polygon.at(-1)).toEqual({ x: 40, y: 50 })
    const peak = polygon.find((p) => p.y === 20)!
    expect(Math.abs(peak.x - 40)).toBeCloseTo(COLLECTOR_DIAGRAM_FT, 6)
  })
})

describe('results on the plan (B3.2)', () => {
  it('T1 SY: line 2 shows 13.0 k, its wall 650 plf, its Collector 9.36 k, plus span diagrams and Chords', () => {
    const html = plan(t1())
    expect(html).toContain('R 13.0 · V 13.0 k')
    expect(html).toContain('13.0 k · 650 plf')
    expect(html).toContain('>9.36 k<')
    expect(html).toContain('class="collector-diagram"')
    expect(html).toContain('class="span-diagram shear"')
    expect(html).toContain('class="span-diagram moment"')
    expect(html).toContain('±2.81 k') // span 2→3 Chord
  })

  it('ASD multiplies seismic by 0.7 and wind by 0.6', () => {
    const seismic = plan(t1(), { showAsd: true })
    expect(seismic).toContain('9.10 k · 455 plf')
    expect(seismic).toContain('>6.55 k<')
    expect(plan(t1w(), { caseId: 'WY', showAsd: true })).toContain('9.00 k · 450 plf') // 15 k on 20 ft = 750 plf × 0.6
  })

  it('ENV shows the governing value and Load Case, separately for strength and ASD', () => {
    expect(plan(t1w(), { caseId: 'ENV' })).toContain('15.0 k (WY)')
    expect(plan(t1w(), { caseId: 'ENV', showAsd: true })).toContain('9.10 k (SY)')
  })

  it('T5: the Roof’s line 2 is tagged as a transfer, and Level 2 draws the transfer Collector', () => {
    expect(plan(t5(), { levelId: 'roof' })).toContain('↓ transfer')
    const level2 = plan(t5(), { levelId: 'level-2' })
    expect(level2).toContain('class="transfer-collector"')
    expect(level2).toContain('↓ 15.0 k · 300 plf · Collector 9.00 k')
  })

  it('each layer can be switched off', () => {
    expect(plan(t1(), { layers: { labels: false } })).not.toContain('class="result-label')
    expect(plan(t1(), { layers: { collectors: false } })).not.toContain('collector-diagram')
    expect(plan(t1(), { layers: { diagrams: false } })).not.toContain('span-diagram')
  })
})

describe('Toolbar results controls (B3.2)', () => {
  it('has the Load Case picker, Strength/ASD, and layer switches', () => {
    const html = plainHtml(renderToString(<Toolbar {...viewProps(t1())} />))
    expect(html).toContain('aria-label="Case"')
    expect(html).toContain('title="Seismic Y" class="active" aria-pressed="true">SY<')
    expect(html).toContain('>ENV<')
    expect(html).toContain('aria-label="Values"')
    expect(html).toContain('aria-label="Show"')
  })
})
