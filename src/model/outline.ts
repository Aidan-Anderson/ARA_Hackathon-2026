// Outline shape rules (docs/spec.md §5.13). Shared: the engine raises outline-invalid with this
// message, and the drawing mode (B2.1) shows it while the user draws.

import type { Point } from './project'

export type OutlineCheck = { ok: true } | { ok: false; message: string }

const EPS = 1e-9

/**
 * Allowed outlines are orthogonal, don't cross themselves, and every straight horizontal or
 * vertical cut passes through one continuous piece: rectangles, L, T, +. Orientation is not checked.
 */
export function checkOutline(outline: Point[]): OutlineCheck {
  if (outline.length < 4) return fail('The outline needs at least 4 corners.')

  const edges = outline.map((a, i) => [a, outline[(i + 1) % outline.length]] as const)
  for (const [a, b] of edges) {
    const dx = Math.abs(b.x - a.x)
    const dy = Math.abs(b.y - a.y)
    if (dx <= EPS && dy <= EPS) return fail('The outline has two corners at the same point.')
    if (dx > EPS && dy > EPS) return fail('Outline edges must be horizontal or vertical.')
  }

  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 2; j < edges.length; j++) {
      if (i === 0 && j === edges.length - 1) continue // adjacent through the closing corner
      if (segmentsTouch(edges[i][0], edges[i][1], edges[j][0], edges[j][1])) {
        return fail('The outline crosses or touches itself.')
      }
    }
  }

  for (const axis of ['x', 'y'] as const) {
    if (maxCrossings(outline, axis) > 2) {
      return fail('This shape is not supported: a straight cut crosses it in two places (U, H, C, or courtyard shapes).')
    }
  }
  return { ok: true }
}

function fail(message: string): OutlineCheck {
  return { ok: false, message }
}

/** Most edge crossings of any cut perpendicular to `axis`, tested between each pair of vertex coordinates. */
function maxCrossings(outline: Point[], axis: 'x' | 'y'): number {
  const coords = [...new Set(outline.map((p) => p[axis]))].sort((a, b) => a - b)
  let most = 0
  for (let i = 0; i + 1 < coords.length; i++) {
    const cut = (coords[i] + coords[i + 1]) / 2
    let crossings = 0
    outline.forEach((a, k) => {
      const b = outline[(k + 1) % outline.length]
      if (a[axis] < cut !== b[axis] < cut) crossings++
    })
    most = Math.max(most, crossings)
  }
  return most
}

function cross(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

function onSegment(a: Point, b: Point, p: Point): boolean {
  return (
    Math.min(a.x, b.x) - EPS <= p.x &&
    p.x <= Math.max(a.x, b.x) + EPS &&
    Math.min(a.y, b.y) - EPS <= p.y &&
    p.y <= Math.max(a.y, b.y) + EPS
  )
}

/** True if the segments cross or touch, including collinear overlap. */
function segmentsTouch(p1: Point, p2: Point, q1: Point, q2: Point): boolean {
  const d1 = cross(q1, q2, p1)
  const d2 = cross(q1, q2, p2)
  const d3 = cross(p1, p2, q1)
  const d4 = cross(p1, p2, q2)
  const opposite = (u: number, v: number) => (u > EPS && v < -EPS) || (u < -EPS && v > EPS)
  if (opposite(d1, d2) && opposite(d3, d4)) return true
  return (
    (Math.abs(d1) <= EPS && onSegment(q1, q2, p1)) ||
    (Math.abs(d2) <= EPS && onSegment(q1, q2, p2)) ||
    (Math.abs(d3) <= EPS && onSegment(p1, p2, q1)) ||
    (Math.abs(d4) <= EPS && onSegment(p1, p2, q2))
  )
}
