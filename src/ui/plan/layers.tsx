// Track B: SVG layers of the plan view (spec §6.2), drawn in screen coordinates so text stays upright.

import type { Axis, Level, Point } from '../../model/project'
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

/** The outline being drawn (B2.1): placed corners, a rubber band to the next corner, and the first corner. */
export function DraftLayer({
  points,
  next,
  closable,
  v,
}: {
  points: Point[]
  next: Point | null
  closable: boolean
  v: Viewport
}) {
  const placed = points.map((p) => toScreen(v, p))
  const rubber = next ? [...placed, toScreen(v, next)] : placed
  return (
    <g className="draft-layer">
      <polyline className="draft-path" points={rubber.map((p) => `${p.x},${p.y}`).join(' ')} />
      {placed.map((p, i) => (
        <circle key={i} className={i === 0 && closable ? 'draft-corner closable' : 'draft-corner'} cx={p.x} cy={p.y} r={i === 0 ? 6 : 4} />
      ))}
    </g>
  )
}

/** Where a Shear Line will go in draw mode (B2.1). */
export function LinePreview({
  direction,
  position,
  bounds,
  v,
}: {
  direction: Axis
  position: number
  bounds: Bounds
  v: Viewport
}) {
  const a = toScreen(v, direction === 'Y' ? { x: position, y: bounds.yMin } : { x: bounds.xMin, y: position })
  const b = toScreen(v, direction === 'Y' ? { x: position, y: bounds.yMax } : { x: bounds.xMax, y: position })
  return <line className="line-preview" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
}

/** Pattern definitions used by the layers. Render once inside the plan's <svg>. */
export function PlanDefs() {
  return (
    <defs>
      <pattern id="opening-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line className="hatch-line" x1="0" y1="0" x2="0" y2="8" />
      </pattern>
    </defs>
  )
}

/** Openings (B2.2): hatched, above the outline fill and below the Shear Lines. */
export function OpeningLayer({ level, v, selection }: { level: Level; v: Viewport; selection: Selection }) {
  return (
    <g className="opening-layer">
      {level.openings.map((opening) => {
        const topLeft = toScreen(v, { x: opening.xMin, y: opening.yMax })
        const bottomRight = toScreen(v, { x: opening.xMax, y: opening.yMin })
        const selected = selection?.kind === 'opening' && selection.id === opening.id
        return (
          <rect
            key={opening.id}
            className={selected ? 'opening selected' : 'opening'}
            x={topLeft.x}
            y={topLeft.y}
            width={bottomRight.x - topLeft.x}
            height={bottomRight.y - topLeft.y}
          />
        )
      })}
    </g>
  )
}

/** The rectangle being dragged out with the Opening tool. */
export function RectPreview({ a, b, v }: { a: Point; b: Point; v: Viewport }) {
  const topLeft = toScreen(v, { x: Math.min(a.x, b.x), y: Math.max(a.y, b.y) })
  const bottomRight = toScreen(v, { x: Math.max(a.x, b.x), y: Math.min(a.y, b.y) })
  return (
    <rect
      className="rect-preview"
      x={topLeft.x}
      y={topLeft.y}
      width={bottomRight.x - topLeft.x}
      height={bottomRight.y - topLeft.y}
    />
  )
}
