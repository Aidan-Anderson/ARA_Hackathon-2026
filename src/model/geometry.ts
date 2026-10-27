import type { Axis, Point, ShearLine } from './project'

/** Offset used to look just before and just after an outline edge. */
const EPS = 1e-6

/**
 * The Diaphragm cross-section along a Shear Line: the outline's extent on the
 * line through `position`, parallel to `direction` (docs/spec.md §5.2).
 *
 * - Y-line at x = position → [yMin, yMax]; X-line at y = position → [xMin, xMax].
 * - At an outline edge exactly at `position`, returns the larger of the two sides.
 * - Returns null when the line misses the outline.
 *
 * For outlines that fail checkOutline (e.g. a U), this is the hull across the gap.
 */
export function crossSection(outline: Point[], direction: Axis, position: number): [number, number] | null {
  const before = cut(outline, direction, position - EPS)
  const after = cut(outline, direction, position + EPS)
  if (!before) return after
  if (!after) return before
  return after[1] - after[0] > before[1] - before[0] ? after : before
}

function cut(outline: Point[], direction: Axis, c: number): [number, number] | null {
  // A Y-line is the cut x = c, collecting y crossings; an X-line swaps the axes.
  const across = direction === 'Y' ? (p: Point) => p.x : (p: Point) => p.y
  const along = direction === 'Y' ? (p: Point) => p.y : (p: Point) => p.x
  const hits: number[] = []
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]
    const b = outline[(i + 1) % outline.length]
    if (across(a) < c !== across(b) < c) {
      const t = (c - across(a)) / (across(b) - across(a))
      hits.push(along(a) + t * (along(b) - along(a)))
    }
  }
  if (hits.length < 2) return null
  return [Math.min(...hits), Math.max(...hits)]
}

/**
 * Where a Shear Line actually runs: its Diaphragm cross-section, cut down to its own `extent` if it
 * has one. null if it misses the Diaphragm.
 */
export function shearLineExtent(outline: Point[], line: ShearLine): [number, number] | null {
  const section = crossSection(outline, line.direction, line.position)
  if (!section || !line.extent) return section
  const lo = Math.max(section[0], line.extent.start)
  const hi = Math.min(section[1], line.extent.end)
  return hi - lo > 1e-9 ? [lo, hi] : null
}

/** True if the line is shorter than the Diaphragm cross-section at its position (ADR 0002). */
export function isShortened(outline: Point[], line: ShearLine): boolean {
  if (!line.extent) return false
  const section = crossSection(outline, line.direction, line.position)
  const extent = shearLineExtent(outline, line)
  if (!section || !extent) return false
  return extent[0] - section[0] > 0.01 || section[1] - extent[1] > 0.01
}
