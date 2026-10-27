// Track B (B2.1): snapping and orthogonal drawing (spec §6.2). Grid mode snaps to Gridlines; both
// modes snap to existing corners, and otherwise to the nearest 1 ft.

import type { Axis, Point } from '../../model/project'
import type { EditorMode } from '../../model/ui'
import type { Gridline } from './grid'

export interface SnapContext {
  mode: EditorMode
  /** Corners to snap to: the outline and the outline being drawn. */
  vertices: Point[]
  gridlines: Gridline[]
  /** ft */
  tolerance: number
}

const SAME = 1e-6

/** Snap one coordinate: to the closest candidate within tolerance, else to the nearest 1 ft. */
export function snapCoordinate(value: number, candidates: number[], tolerance: number): number {
  let best: number | null = null
  for (const candidate of candidates) {
    if (Math.abs(candidate - value) <= tolerance && (best === null || Math.abs(candidate - value) < Math.abs(best - value))) {
      best = candidate
    }
  }
  return best ?? Math.round(value)
}

/** Candidate positions along x ('x') or y ('y'): corner coordinates, plus Gridlines in Grid mode. */
function candidates(ctx: SnapContext, axis: 'x' | 'y'): number[] {
  const gridDirection: Axis = axis === 'x' ? 'Y' : 'X' // vertical Gridlines fix x
  return [
    ...ctx.vertices.map((p) => p[axis]),
    ...(ctx.mode === 'grid' ? ctx.gridlines.filter((g) => g.direction === gridDirection).map((g) => g.position) : []),
  ]
}

/** A free point: an existing corner if one is close, else each coordinate snapped on its own. */
export function snapPoint(raw: Point, ctx: SnapContext): Point {
  const corner = ctx.vertices.find((v) => Math.hypot(v.x - raw.x, v.y - raw.y) <= ctx.tolerance)
  if (corner) return { ...corner }
  return { x: snapCoordinate(raw.x, candidates(ctx, 'x'), ctx.tolerance), y: snapCoordinate(raw.y, candidates(ctx, 'y'), ctx.tolerance) }
}

/** The next corner after `last`: horizontal or vertical, whichever is closer to the mouse. */
export function nextVertex(last: Point | null, raw: Point, ctx: SnapContext): Point {
  if (!last) return snapPoint(raw, ctx)
  return Math.abs(raw.x - last.x) >= Math.abs(raw.y - last.y)
    ? { x: snapCoordinate(raw.x, candidates(ctx, 'x'), ctx.tolerance), y: last.y }
    : { x: last.x, y: snapCoordinate(raw.y, candidates(ctx, 'y'), ctx.tolerance) }
}

/** A Shear Line position in draw mode: x for Y-lines, y for X-lines, snapped like a coordinate. */
export function snapLinePosition(raw: Point, direction: Axis, ctx: SnapContext): number {
  return direction === 'Y'
    ? snapCoordinate(raw.x, candidates(ctx, 'x'), ctx.tolerance)
    : snapCoordinate(raw.y, candidates(ctx, 'y'), ctx.tolerance)
}

/**
 * Finish an outline: add a corner if the last edge doesn't line up with the start, drop repeated and
 * in-line corners, and make it counter-clockwise.
 */
export function closeOutline(points: Point[]): Point[] {
  let pts = withoutRepeats(points)
  if (pts.length >= 2) {
    const first = pts[0]
    const last = pts[pts.length - 1]
    if (!same(first.x, last.x) && !same(first.y, last.y)) {
      const prev = pts[pts.length - 2]
      const lastWasHorizontal = prev !== undefined && same(prev.y, last.y)
      pts = [...pts, lastWasHorizontal ? { x: last.x, y: first.y } : { x: first.x, y: last.y }]
    }
  }
  pts = withoutInLine(withoutRepeats(pts))
  return signedArea(pts) < 0 ? pts.reverse() : pts
}

function same(a: number, b: number): boolean {
  return Math.abs(a - b) < SAME
}

/** Drop consecutive duplicates, including a last point that repeats the first. */
function withoutRepeats(points: Point[]): Point[] {
  const out = points.filter((p, i) => i === 0 || !same(p.x, points[i - 1].x) || !same(p.y, points[i - 1].y))
  while (out.length > 1 && same(out[0].x, out[out.length - 1].x) && same(out[0].y, out[out.length - 1].y)) out.pop()
  return out
}

/** Drop corners that sit in a straight run (all three on one x or one y). */
function withoutInLine(points: Point[]): Point[] {
  let pts = points
  let changed = true
  while (changed && pts.length > 3) {
    changed = false
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i - 1 + pts.length) % pts.length]
      const b = pts[i]
      const c = pts[(i + 1) % pts.length]
      if ((same(a.x, b.x) && same(b.x, c.x)) || (same(a.y, b.y) && same(b.y, c.y))) {
        pts = pts.filter((_, k) => k !== i)
        changed = true
        break
      }
    }
  }
  return pts
}

function signedArea(points: Point[]): number {
  return points.reduce((sum, a, i) => {
    const b = points[(i + 1) % points.length]
    return sum + a.x * b.y - b.x * a.y
  }, 0)
}

/** Default name for a drawn Shear Line, e.g. "Y@40" or "X@12.5". */
export function drawnLineName(direction: Axis, position: number): string {
  return `${direction}@${Number(position.toFixed(2))}`
}
