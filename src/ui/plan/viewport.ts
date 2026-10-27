// Track B: the mapping between plan coordinates (ft, y up) and screen pixels (y down) (spec §6.2).
// screen x = ox + x · scale, screen y = oy − y · scale.

import type { Point } from '../../model/project'

export interface Viewport {
  /** px per ft */
  scale: number
  /** Screen position of the plan origin. */
  ox: number
  oy: number
}

export interface Bounds {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

export function toScreen(v: Viewport, p: Point): { x: number; y: number } {
  return { x: v.ox + p.x * v.scale, y: v.oy - p.y * v.scale }
}

export function toPlan(v: Viewport, sx: number, sy: number): Point {
  return { x: (sx - v.ox) / v.scale, y: (v.oy - sy) / v.scale }
}

/** Fit the bounds into a width × height area with `padding` px all round, centered. */
export function fitViewport(bounds: Bounds, width: number, height: number, padding = 56): Viewport {
  const planWidth = Math.max(bounds.xMax - bounds.xMin, 1)
  const planHeight = Math.max(bounds.yMax - bounds.yMin, 1)
  const scale = Math.max(Math.min((width - 2 * padding) / planWidth, (height - 2 * padding) / planHeight), 0.01)
  const cx = (bounds.xMin + bounds.xMax) / 2
  const cy = (bounds.yMin + bounds.yMax) / 2
  return { scale, ox: width / 2 - cx * scale, oy: height / 2 + cy * scale }
}

/** Zoom by `factor` keeping the plan point under the screen point (sx, sy) where it is. */
export function zoomAt(v: Viewport, factor: number, sx: number, sy: number): Viewport {
  const scale = Math.min(Math.max(v.scale * factor, 0.05), 400)
  const anchor = toPlan(v, sx, sy)
  return { scale, ox: sx - anchor.x * scale, oy: sy + anchor.y * scale }
}

export function boundsOf(points: Point[]): Bounds | null {
  if (points.length === 0) return null
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return { xMin: Math.min(...xs), xMax: Math.max(...xs), yMin: Math.min(...ys), yMax: Math.max(...ys) }
}
