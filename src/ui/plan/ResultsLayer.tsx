// Track B (B3.2): results drawn on the plan for the current Level and Load Case, or the Envelope
// (spec §6.3). Labels follow the Strength/ASD toggle.

import type { ReactNode } from 'react'
import { crossSection } from '../../model/geometry'
import type { Axis, Level, Project, ShearLine } from '../../model/project'
import type { CaseResult, EnvelopeEntry, LevelResult, Results, SpanResult } from '../../model/results'
import type { CaseView, EditorState } from '../../model/ui'
import { alongLine, lineExtent } from './lineGeometry'
import {
  besideLine,
  COLLECTOR_DIAGRAM_FT,
  collectorPolygon,
  findElement,
  indexOfMaxAbs,
  kips,
  plf,
  utilizationColor,
} from './resultsGeometry'
import { toScreen, type Bounds, type Viewport } from './viewport'

/** Screen layout of the span diagrams beside the plan. */
const DIAGRAM_GAP_PX = 92 // clears the Gridline bubbles below the plan
const DIAGRAM_AMP_PX = 26
const DIAGRAM_SPACING_PX = 72

interface Props {
  project: Project
  level: Level
  results: Results
  caseId: CaseView
  showAsd: boolean
  layers: EditorState['layers']
  v: Viewport
  bounds: Bounds
}

export function ResultsLayer(props: Props) {
  return props.caseId === 'ENV' ? <EnvelopeOverlay {...props} /> : <CaseOverlay {...props} caseResult={props.results.cases[props.caseId]} />
}

function CaseOverlay({ level, caseResult, showAsd, layers, v, bounds }: Props & { caseResult: CaseResult }) {
  const levelResult = caseResult.levels.find((result) => result.levelId === level.id)
  if (!levelResult || levelResult.lines.length === 0) return null
  const factor = showAsd ? caseResult.asdFactor : 1
  const maxPlf = Math.max(0, ...levelResult.lines.flatMap((l) => l.elements.map((e) => e.unitShear)))
  const maxCollector = Math.max(
    0,
    ...levelResult.lines.map((l) => l.collector.maxForce),
    ...levelResult.transfersIn.map((t) => t.collector.maxForce),
  )
  const ftPerKip = maxCollector > 1e-9 ? COLLECTOR_DIAGRAM_FT / maxCollector : 0

  return (
    <g className="results-layer">
      {layers.diagrams && (
        <SpanDiagrams level={level} levelResult={levelResult} direction={caseResult.direction} factor={factor} v={v} bounds={bounds} labels={layers.labels} />
      )}
      {levelResult.lines.map((lineResult) => {
        const line = level.shearLines.find((l) => l.id === lineResult.lineId)
        if (!line) return null
        return (
          <g key={line.id}>
            {layers.collectors && lineResult.collector.maxForce > 1e-6 && (
              <CollectorDiagram line={line} force={lineResult.collector.force} ftPerKip={ftPerKip} factor={factor} v={v} label={layers.labels} />
            )}
            {lineResult.elements.map((demand) => {
              const element = line.lateralElements.find((e) => e.id === demand.elementId)
              if (!element) return null
              const a = toScreen(v, alongLine(line, element.start))
              const b = toScreen(v, alongLine(line, element.end))
              return (
                <g key={element.id}>
                  <line
                    className="element-result"
                    stroke={utilizationColor(maxPlf > 0 ? demand.unitShear / maxPlf : 0)}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                  />
                  {layers.labels && (
                    <SideLabel line={line} a={a} b={b}>
                      {kips(demand.force * factor)} k · {plf(demand.unitShear * factor)} plf
                    </SideLabel>
                  )}
                </g>
              )
            })}
            {layers.labels && (
              <LineEndLabel level={level} line={line} bounds={bounds} v={v}>
                R {kips(lineResult.reactionFx * factor)} · V {kips(lineResult.storyShear * factor)} k
                {!lineResult.continuesBelow && <tspan className="stop"> ↓ transfer</tspan>}
              </LineEndLabel>
            )}
          </g>
        )
      })}
      {levelResult.transfersIn.map((transfer) => {
        const line = { direction: caseResult.direction, position: transfer.position }
        const section = crossSection(level.outline, line.direction, line.position)
        if (!section) return null
        const a = toScreen(v, besideLine(line, section[0], 0))
        const b = toScreen(v, besideLine(line, section[1], 0))
        return (
          <g key={`${transfer.fromLevelId}:${transfer.fromLineId}`}>
            <line className="transfer-collector" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            {layers.collectors && transfer.collector.maxForce > 1e-6 && (
              <CollectorDiagram line={line} force={transfer.collector.force} ftPerKip={ftPerKip} factor={factor} v={v} label={false} />
            )}
            {layers.labels && (
              <text className="result-label transfer-label" {...endLabelPosition(line.direction, b)}>
                ↓ {kips(transfer.force * factor)} k · {plf(transfer.collectorPlf * factor)} plf · Collector{' '}
                {kips(transfer.collector.maxForce * factor)} k
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}

function CollectorDiagram({
  line,
  force,
  ftPerKip,
  factor,
  v,
  label,
}: {
  line: Pick<ShearLine, 'direction' | 'position'>
  force: { s: number[]; v: number[] }
  ftPerKip: number
  factor: number
  v: Viewport
  label: boolean
}) {
  const points = collectorPolygon(line, force, ftPerKip).map((p) => toScreen(v, p))
  const peak = indexOfMaxAbs(force.v)
  const tip = peak >= 0 ? toScreen(v, besideLine(line, force.s[peak], force.v[peak] * ftPerKip)) : null
  return (
    <g className="collector">
      <polygon className="collector-diagram" points={points.map((p) => `${p.x},${p.y}`).join(' ')} />
      {label && tip && (
        <text className="result-label collector-label" x={tip.x + (line.direction === 'Y' ? 4 : 0)} y={tip.y - (line.direction === 'Y' ? 0 : 6)}>
          {kips(Math.abs(force.v[peak]) * factor)} k
        </text>
      )}
    </g>
  )
}

/** Shear and moment diagrams for every span, beside the plan, plus the max Chord on both edges. */
function SpanDiagrams({
  level,
  levelResult,
  direction,
  factor,
  v,
  bounds,
  labels,
}: {
  level: Level
  levelResult: LevelResult
  direction: Axis
  factor: number
  v: Viewport
  bounds: Bounds
  labels: boolean
}) {
  const spans = levelResult.spans
  if (spans.length === 0) return null
  const loadInY = direction === 'Y' // spans run along x, diagrams go below the plan
  const firstBase = loadInY ? toScreen(v, { x: 0, y: bounds.yMin }).y + DIAGRAM_GAP_PX : toScreen(v, { x: bounds.xMax, y: 0 }).x + DIAGRAM_GAP_PX
  const maxShear = Math.max(...spans.map((s) => s.maxShear))
  const maxMoment = Math.max(...spans.map((s) => s.maxMoment))
  const along = (s: number) => (loadInY ? toScreen(v, { x: s, y: 0 }).x : toScreen(v, { x: 0, y: s }).y)
  const point = (s: number, value: number, base: number, max: number) => {
    const offset = max > 1e-9 ? (value / max) * DIAGRAM_AMP_PX : 0
    return loadInY ? { x: along(s), y: base - offset } : { x: base + offset, y: along(s) }
  }

  const row = (rowSpans: SpanResult[], kind: 'shear' | 'moment', base: number, max: number, caption: string) => {
    const start = Math.min(...rowSpans.map((s) => s.start))
    const end = Math.max(...rowSpans.map((s) => s.end))
    return (
      <g className={`span-band ${kind}`}>
        <line className="diagram-baseline" {...segment(point(start, 0, base, max), point(end, 0, base, max))} />
        {rowSpans.map((span) => {
          const diagram = kind === 'shear' ? span.shear : span.moment
          const pts = [point(span.start, 0, base, max), ...diagram.s.map((s, i) => point(s, diagram.v[i], base, max)), point(span.end, 0, base, max)]
          const peak = indexOfMaxAbs(diagram.v)
          const tip = peak >= 0 ? point(diagram.s[peak], diagram.v[peak], base, max) : null
          return (
            <g key={`${span.start}-${span.end}`}>
              <polygon className={`span-diagram ${kind}`} points={pts.map((p) => `${p.x},${p.y}`).join(' ')} />
              {labels && tip && Math.abs(diagram.v[peak]) > 1e-6 && (
                <text className="result-label" x={tip.x + (loadInY ? 0 : 4)} y={tip.y - (loadInY ? 4 : 0)} textAnchor={loadInY ? 'middle' : 'start'}>
                  {kips(Math.abs(diagram.v[peak]) * factor)}
                </text>
              )}
            </g>
          )
        })}
        {labels && (
          <text className="diagram-caption" {...captionPosition(loadInY, point(start, 0, base, max))}>
            {caption}
          </text>
        )}
      </g>
    )
  }

  // Shortened Shear Lines split the Diaphragm into strips (ADR 0002): one pair of diagrams per strip.
  return (
    <g className="span-diagrams">
      {groupByStrip(spans).map((strip, k) => {
        const shearBase = firstBase + k * 2 * DIAGRAM_SPACING_PX
        const label = strip.band ? ` · strip ${loadInY ? 'y' : 'x'} ${strip.band.from}–${strip.band.to}` : ''
        return (
          <g key={k}>
            {row(strip.spans, 'shear', shearBase, maxShear, `V (k)${label}`)}
            {row(strip.spans, 'moment', shearBase + DIAGRAM_SPACING_PX, maxMoment, `M (k-ft)${label}`)}
          </g>
        )
      })}
      {labels &&
        spans.map((span) => (
          <ChordLabels key={`${span.band?.from ?? ''}:${span.start}-${span.end}`} level={level} span={span} direction={direction} factor={factor} v={v} />
        ))}
    </g>
  )
}

/** Spans grouped by the strip they belong to (one group when there are no strips). */
function groupByStrip(spans: SpanResult[]): { band?: SpanResult['band']; spans: SpanResult[] }[] {
  const groups = new Map<string, { band?: SpanResult['band']; spans: SpanResult[] }>()
  for (const span of spans) {
    const key = span.band ? `${span.band.from}-${span.band.to}` : ''
    if (!groups.has(key)) groups.set(key, { band: span.band, spans: [] })
    groups.get(key)!.spans.push(span)
  }
  return [...groups.values()]
}

/** "±T/C" at the max Chord, just inside both Chord edges of the span. */
function ChordLabels({ level, span, direction, factor, v }: { level: Level; span: SpanResult; direction: Axis; factor: number; v: Viewport }) {
  const peak = indexOfMaxAbs(span.chord.v)
  if (peak < 0 || span.chord.v[peak] < 1e-6) return null
  const s = span.chord.s[peak]
  const full = crossSection(level.outline, direction, s)
  // A span in a strip has its Chords at the strip's edges.
  const section = full && span.band ? [Math.max(full[0], span.band.from), Math.min(full[1], span.band.to)] : full
  if (!section) return null
  const text = `±${kips(span.chord.v[peak] * factor)} k`
  const edge = (t: number) => toScreen(v, direction === 'Y' ? { x: s, y: t } : { x: t, y: s })
  const [lo, hi] = [edge(section[0]), edge(section[1])]
  return direction === 'Y' ? (
    <g className="chord-labels">
      <text className="result-label chord-label" x={lo.x} y={lo.y - 6} textAnchor="middle">{text}</text>
      <text className="result-label chord-label" x={hi.x} y={hi.y + 14} textAnchor="middle">{text}</text>
    </g>
  ) : (
    <g className="chord-labels">
      <text className="result-label chord-label" x={lo.x + 6} y={lo.y} dominantBaseline="central">{text}</text>
      <text className="result-label chord-label" x={hi.x - 6} y={hi.y} textAnchor="end" dominantBaseline="central">{text}</text>
    </g>
  )
}

/** Governing values with their Load Case, e.g. "15.0 k (WY)". */
function EnvelopeOverlay({ project, level, results, showAsd, layers, v, bounds }: Props) {
  if (!layers.labels) return null
  const entries = results.envelope.filter((entry) => entry.levelId === level.id)
  return (
    <g className="results-layer envelope">
      {entries.map((entry) => {
        const governing = showAsd ? entry.asd : entry.strength
        const value = entry.quantity === 'unitShear' ? `${plf(governing.value)} plf` : `${kips(governing.value)} k`
        return (
          <EnvelopeLabel key={`${entry.kind}|${entry.refId}|${entry.quantity}`} project={project} level={level} entry={entry} v={v} bounds={bounds}>
            {value} ({governing.caseId})
          </EnvelopeLabel>
        )
      })}
    </g>
  )
}

function EnvelopeLabel({
  project,
  level,
  entry,
  v,
  bounds,
  children,
}: {
  project: Project
  level: Level
  entry: EnvelopeEntry
  v: Viewport
  bounds: Bounds
  children: ReactNode
}) {
  const lineOf = (id: string) => level.shearLines.find((l) => l.id === id)
  switch (entry.kind) {
    case 'lateralElement': {
      const found = findElement(level, entry.refId)
      if (!found) return null
      const a = toScreen(v, alongLine(found.line, found.element.start))
      const b = toScreen(v, alongLine(found.line, found.element.end))
      return <SideLabel line={found.line} a={a} b={b}>{children}</SideLabel>
    }
    case 'line': {
      const line = lineOf(entry.refId)
      return line ? <LineEndLabel level={level} line={line} bounds={bounds} v={v}>V {children}</LineEndLabel> : null
    }
    case 'collector': {
      const line = lineOf(entry.refId)
      if (!line) return null
      const [lo, hi] = lineExtent(level, line, bounds)
      const p = toScreen(v, alongLine(line, (lo + hi) / 2))
      return (
        <text className="result-label collector-label" x={p.x + (line.direction === 'Y' ? 6 : 0)} y={p.y - (line.direction === 'Y' ? 0 : 8)}>
          Collector {children}
        </text>
      )
    }
    case 'transferCollector': {
      const [fromLevelId, fromLineId] = entry.refId.split(':')
      const from = project.levels.find((l) => l.id === fromLevelId)?.shearLines.find((l) => l.id === fromLineId)
      const section = from && crossSection(level.outline, from.direction, from.position)
      if (!from || !section) return null
      const end = toScreen(v, alongLine(from, section[1]))
      return <text className="result-label transfer-label" {...endLabelPosition(from.direction, end)}>↓ Collector {children}</text>
    }
    case 'span': {
      const [path, strip] = entry.refId.split('@') // "@from-to" marks a span in a strip (ADR 0002)
      const [fromId, toId] = path.split('→')
      const from = lineOf(fromId)
      const to = lineOf(toId)
      const direction = (from ?? to)?.direction
      if (!direction) return null
      const lo = from?.position ?? (direction === 'Y' ? bounds.xMin : bounds.yMin)
      const hi = to?.position ?? (direction === 'Y' ? bounds.xMax : bounds.yMax)
      const mid = (lo + hi) / 2
      // Chord labels along the bottom (or left) edge, unit shear along the top (or right) edge: of the
      // strip if the span is in one, else of the plan.
      const [edgeLo, edgeHi] = strip
        ? strip.split('-').map(Number)
        : direction === 'Y'
          ? [bounds.yMin, bounds.yMax]
          : [bounds.xMin, bounds.xMax]
      const chord = entry.quantity === 'chord'
      const p = toScreen(
        v,
        direction === 'Y' ? { x: mid, y: chord ? edgeLo : edgeHi } : { x: chord ? edgeLo : edgeHi, y: mid },
      )
      return direction === 'Y' ? (
        <text className="result-label chord-label" x={p.x} y={p.y + (chord ? -6 : 14)} textAnchor="middle">
          {chord ? 'Chord' : 'v'} {children}
        </text>
      ) : (
        <text className="result-label chord-label" x={p.x + (chord ? 6 : -6)} y={p.y} textAnchor={chord ? 'start' : 'end'} dominantBaseline="central">
          {chord ? 'Chord' : 'v'} {children}
        </text>
      )
    }
  }
}

/** A label beside a Lateral Element: left of a Y-line, below an X-line. */
function SideLabel({ line, a, b, children }: { line: ShearLine; a: { x: number; y: number }; b: { x: number; y: number }; children: ReactNode }) {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  return line.direction === 'Y' ? (
    <text className="result-label" x={mid.x - 8} y={mid.y} textAnchor="end" dominantBaseline="central">{children}</text>
  ) : (
    <text className="result-label" x={mid.x} y={mid.y + 16} textAnchor="middle">{children}</text>
  )
}

/** A label past the far end of a Shear Line, just beyond its name. */
function LineEndLabel({ level, line, bounds, v, children }: { level: Level; line: ShearLine; bounds: Bounds; v: Viewport; children: ReactNode }) {
  const [, hi] = lineExtent(level, line, bounds)
  const end = toScreen(v, alongLine(line, hi))
  return line.direction === 'Y' ? (
    <text className="result-label line-result" x={end.x} y={end.y - 22} textAnchor="middle">{children}</text>
  ) : (
    <text className="result-label line-result" x={end.x + 8} y={end.y + 14}>{children}</text>
  )
}

function endLabelPosition(direction: Axis, end: { x: number; y: number }) {
  return direction === 'Y' ? { x: end.x, y: end.y - 22, textAnchor: 'middle' as const } : { x: end.x + 8, y: end.y + 14 }
}

function captionPosition(loadInY: boolean, start: { x: number; y: number }) {
  return loadInY ? { x: start.x - 8, y: start.y, textAnchor: 'end' as const, dominantBaseline: 'central' as const } : { x: start.x, y: start.y - 10, textAnchor: 'middle' as const }
}

function segment(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y }
}
