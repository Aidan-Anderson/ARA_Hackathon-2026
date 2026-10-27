// Track B (B4.1): the Level below, drawn faintly so Shear Lines can be lined up (or stopped on purpose).

import type { Level } from '../../model/project'
import { alongLine, lineExtent } from './lineGeometry'
import { toScreen, type Bounds, type Viewport } from './viewport'
import './GhostLayer.css'

export function GhostLayer({ level, v, bounds }: { level: Level; v: Viewport; bounds: Bounds }) {
  const outline = level.outline.map((p) => toScreen(v, p)).map((p) => `${p.x},${p.y}`)
  return (
    <g className="ghost-layer" aria-label={`Ghost of ${level.name}`}>
      <polygon className="ghost-outline" points={outline.join(' ')} />
      {level.shearLines.map((line) => {
        const [lo, hi] = lineExtent(level, line, bounds)
        const a = toScreen(v, alongLine(line, lo))
        const b = toScreen(v, alongLine(line, hi))
        return <line key={line.id} className="ghost-line" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      })}
    </g>
  )
}
