// Track B: what's under the cursor on the plan. Smaller targets win: a Lateral Element over its
// Shear Line, and either over an Opening.

import type { Level, Point } from '../../model/project'
import { lineExtent } from './lineGeometry'
import type { Bounds } from './viewport'

export type Hit =
  | { kind: 'lateralElement'; lineId: string; id: string }
  | { kind: 'shearLine'; id: string }
  | { kind: 'opening'; id: string }

type Candidate = { hit: Hit; distance: number }

/** The item at p: the nearest element or line within `tolerance` ft, else the Opening p is inside. */
export function hitTest(level: Level, bounds: Bounds, p: Point, tolerance: number): Hit | null {
  const elements: Candidate[] = level.shearLines.flatMap((line) =>
    line.lateralElements.map((element) => ({
      hit: { kind: 'lateralElement' as const, lineId: line.id, id: element.id },
      distance: distanceToLine(p, line.direction, line.position, element.start, element.end),
    })),
  )
  const lines: Candidate[] = level.shearLines.map((line) => {
    const [lo, hi] = lineExtent(level, line, bounds)
    return { hit: { kind: 'shearLine' as const, id: line.id }, distance: distanceToLine(p, line.direction, line.position, lo, hi) }
  })
  for (const group of [elements, lines]) {
    const nearest = closest(group, tolerance)
    if (nearest) return nearest
  }
  const opening = level.openings.find((o) => p.x >= o.xMin && p.x <= o.xMax && p.y >= o.yMin && p.y <= o.yMax)
  return opening ? { kind: 'opening', id: opening.id } : null
}

function closest(candidates: Candidate[], tolerance: number): Hit | null {
  let best: Candidate | null = null
  for (const candidate of candidates) {
    if (candidate.distance <= tolerance && (!best || candidate.distance < best.distance)) best = candidate
  }
  return best?.hit ?? null
}

/** Distance from p to the segment [lo, hi] of a line at `position`, parallel to `direction`. */
function distanceToLine(p: Point, direction: 'X' | 'Y', position: number, lo: number, hi: number): number {
  const across = direction === 'Y' ? p.x - position : p.y - position
  const along = direction === 'Y' ? p.y : p.x
  return Math.hypot(across, Math.max(lo - along, 0, along - hi))
}
