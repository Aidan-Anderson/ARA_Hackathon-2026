// Diaphragm cross-sections along the span axis (docs/spec.md §5.2, §5.7).
// For load in Y the span axis is x and depth is measured in y; for load in X they swap.

import { crossSection } from '../model/geometry'
import type { Axis, Level, Opening, Point } from '../model/project'

/** A stretch of the span axis where the depth is constant. */
export interface DepthPiece {
  from: number
  to: number
  depth: number
}

export interface Sections {
  /** Outline depth. Chords use it. */
  gross: DepthPiece[]
  /** Outline depth minus Openings. Loads, unit shear, and Collectors use it. */
  net: DepthPiece[]
  /** sf, outline minus Openings */
  netArea: number
}

/** An inside corner where the gross depth steps (spec §5.7). */
export interface ReentrantVertex {
  s: number
  point: Point
  /** The smaller of the two gross depths at s. */
  narrowDepth: number
}

const EPS = 1e-9

export function levelSections(level: Level, direction: Axis): Sections {
  const across = acrossOf(direction)
  const openingAcross = (o: Opening): [number, number] => (direction === 'Y' ? [o.xMin, o.xMax] : [o.yMin, o.yMax])
  const openingAlong = (o: Opening): [number, number] => (direction === 'Y' ? [o.yMin, o.yMax] : [o.xMin, o.xMax])

  const breaks = uniqueSorted([...level.outline.map(across), ...level.openings.flatMap(openingAcross)])
  const gross: DepthPiece[] = []
  const net: DepthPiece[] = []
  for (let i = 0; i + 1 < breaks.length; i++) {
    const from = breaks[i]
    const to = breaks[i + 1]
    const mid = (from + to) / 2
    const section = crossSection(level.outline, direction, mid)
    if (!section) continue
    const [lo, hi] = section
    const holes = level.openings
      .filter((o) => openingAcross(o)[0] < mid && mid < openingAcross(o)[1])
      .map((o) => openingAlong(o))
    gross.push({ from, to, depth: hi - lo })
    net.push({ from, to, depth: hi - lo - coveredLength(holes, lo, hi) })
  }
  const netArea = net.reduce((sum, piece) => sum + piece.depth * (piece.to - piece.from), 0)
  return { gross, net, netArea }
}

/** The Diaphragm's extent along the span axis. */
export function extentOf(pieces: DepthPiece[]): [number, number] | null {
  return pieces.length === 0 ? null : [pieces[0].from, pieces[pieces.length - 1].to]
}

/** Depth at s from the piece just left of s, or just right of it. 0 outside the Diaphragm. */
export function depthAt(pieces: DepthPiece[], s: number, side: 'left' | 'right'): number {
  const piece = pieces.find((p) =>
    side === 'left' ? p.from < s - EPS && s <= p.to + EPS : p.from - EPS <= s && s < p.to - EPS,
  )
  return piece?.depth ?? 0
}

/**
 * Inside corners where the gross depth steps along the span axis. At such a step, the outline
 * vertices that sit strictly inside the wider cross-section are the inside corners.
 */
export function reentrantVertices(outline: Point[], direction: Axis, gross: DepthPiece[]): ReentrantVertex[] {
  const across = acrossOf(direction)
  const along = direction === 'Y' ? (p: Point) => p.y : (p: Point) => p.x
  const corners: ReentrantVertex[] = []
  for (const s of uniqueSorted(outline.map(across))) {
    const left = depthAt(gross, s, 'left')
    const right = depthAt(gross, s, 'right')
    if (left <= 0 || right <= 0 || Math.abs(left - right) < 1e-6) continue
    const wider = crossSection(outline, direction, left > right ? s - 1e-3 : s + 1e-3)
    if (!wider) continue
    for (const point of outline) {
      if (Math.abs(across(point) - s) < EPS && along(point) > wider[0] + 1e-6 && along(point) < wider[1] - 1e-6) {
        corners.push({ s, point, narrowDepth: Math.min(left, right) })
      }
    }
  }
  return corners
}

function acrossOf(direction: Axis): (p: Point) => number {
  return direction === 'Y' ? (p) => p.x : (p) => p.y
}

/** Length of [lo, hi] covered by the union of the intervals. */
function coveredLength(intervals: [number, number][], lo: number, hi: number): number {
  const clipped = intervals
    .map(([a, b]): [number, number] => [Math.max(a, lo), Math.min(b, hi)])
    .filter(([a, b]) => b > a)
    .sort((p, q) => p[0] - q[0])
  let covered = 0
  let reach = lo
  for (const [a, b] of clipped) {
    if (b <= reach) continue
    covered += b - Math.max(a, reach)
    reach = b
  }
  return covered
}

function uniqueSorted(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.filter((value, i) => i === 0 || value - sorted[i - 1] > EPS)
}
