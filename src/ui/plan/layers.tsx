// Track B: SVG layers of the plan view (spec §6.2), drawn in screen coordinates so text stays upright.

import type { Level } from '../../model/project'
import type { Selection } from '../../model/ui'
import type { Gridline } from './grid'
import { alongLine, lineExtent } from './lineGeometry'
import { toScreen, type Bounds, type Viewport } from './viewport'

const BUBBLE_R = 10
const GRID_MARGIN_PX = 28

export function GridLayer({
  lines,
  v,
  bounds,
  highlight,
}: {
  lines: Gridline[]
  v: Viewport
  bounds: Bounds
  highlight: Gridline | null
}) {
  const margin = GRID_MARGIN_PX / v.scale
  return (
    <g className="grid-layer">
      {lines.map((line) => {
        const vertical = line.direction === 'Y'
        const a = toScreen(v, vertical ? { x: line.position, y: bounds.yMin - margin } : { x: bounds.xMin - margin, y: line.position })
        const b = toScreen(v, vertical ? { x: line.position, y: bounds.yMax + margin } : { x: bounds.xMax + margin, y: line.position })
        // Numbered bubbles below the plan, lettered bubbles to its left.
        const bubble = vertical ? { x: a.x, y: a.y + BUBBLE_R + 2 } : { x: a.x - BUBBLE_R - 2, y: a.y }
        const active = highlight?.direction === line.direction && highlight.label === line.label
        return (
          <g key={`${line.direction}-${line.label}`} className={active ? 'gridline active' : 'gridline'}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            <circle cx={bubble.x} cy={bubble.y} r={BUBBLE_R} />
            <text x={bubble.x} y={bubble.y} textAnchor="middle" dominantBaseline="central">
              {line.label}
            </text>
          </g>
        )
      })}
    </g>
  )
}

export function OutlineLayer({ level, v }: { level: Level; v: Viewport }) {
  const points = level.outline.map((p) => toScreen(v, p)).map((p) => `${p.x},${p.y}`)
  return <polygon className="outline" points={points.join(' ')} />
}

export function ShearLineLayer({
  level,
  v,
  bounds,
  selection,
}: {
  level: Level
  v: Viewport
  bounds: Bounds
  selection: Selection
}) {
  return (
    <g className="shear-line-layer">
      {level.shearLines.map((line) => {
        const [lo, hi] = lineExtent(level, line, bounds)
        const a = toScreen(v, alongLine(line, lo))
        const b = toScreen(v, alongLine(line, hi))
        const selected = selection?.kind === 'shearLine' && selection.id === line.id
        // Label past the top end of a Y-line, or past the right end of an X-line.
        const label: { x: number; y: number; anchor: 'middle' | 'start' } =
          line.direction === 'Y' ? { x: b.x, y: b.y - 8, anchor: 'middle' } : { x: b.x + 8, y: b.y, anchor: 'start' }
        return (
          <g key={line.id} className={selected ? 'shear-line selected' : 'shear-line'}>
            <line className="line-axis" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            {line.lateralElements.map((element) => {
              const ea = toScreen(v, alongLine(line, element.start))
              const eb = toScreen(v, alongLine(line, element.end))
              const elementSelected = selection?.kind === 'lateralElement' && selection.id === element.id
              return (
                <line
                  key={element.id}
                  className={`element ${element.kind}${elementSelected ? ' selected' : ''}`}
                  x1={ea.x}
                  y1={ea.y}
                  x2={eb.x}
                  y2={eb.y}
                />
              )
            })}
            <text className="line-label" x={label.x} y={label.y} textAnchor={label.anchor} dominantBaseline="central">
              {line.name}
            </text>
          </g>
        )
      })}
    </g>
  )
}
