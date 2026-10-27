// Diaphragm cross-sections along the span axis (docs/spec.md §5.2, §5.7).
// For load in Y the span axis is x and depth is measured in y; for load in X they swap.

import { crossSection } from '../model/geometry'
import type { Axis, Level, Opening, Point } from '../model/project'
import { EPS, uniqueSorted } from './math'

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

/** The Diaphragm along one cut: its cross-section and the parts of it outside Openings. */
export interface Cut {
  section: [number, number]
  net: [number, number][]
}

/**
 * Cross-sections along the span axis. With `band`, only the strip of Diaphragm between band[0] and
 * band[1] across the depth counts (shortened Shear Lines, ADR 0002).
 */
export function levelSections(level: Level, direction: Axis, band?: [number, number]): Sections {
  const across = acrossOf(direction)
  const breaks = uniqueSorted([
    ...level.outline.map(across),
    ...level.openings.flatMap((o) => openingAcross(o, direction)),
  ])
  const gross: DepthPiece[] = []
  const net: DepthPiece[] = []
  for (let i = 0; i + 1 < breaks.length; i++) {
    const from = breaks[i]
    const to = breaks[i + 1]
    const cut = cutAt(level, direction, (from + to) / 2, band)
    if (!cut) continue
    gross.push({ from, to, depth: cut.section[1] - cut.section[0] })
    net.push({ from, to, depth: totalLength(cut.net) })
  }
  const netArea = net.reduce((sum, piece) => sum + piece.depth * (piece.to - piece.from), 0)
  return { gross, net, netArea }
}

/**
 * The cut at s along the load direction, which is also where a Shear Line at position s runs.
 * Openings count only where s passes strictly through them. With `clip`, only that part of the cut
 * counts (a strip, or a shortened line's extent). null if s misses the Diaphragm.
 */
export function cutAt(level: Level, direction: Axis, s: number, clip?: [number, number]): Cut | null {
  const full = crossSection(level.outline, direction, s)
  if (!full) return null
  const section: [number, number] = clip ? [Math.max(full[0], clip[0]), Math.min(full[1], clip[1])] : full
  if (section[1] - section[0] <= EPS) return null
  const holes = level.openings
    .filter((o) => {
      const [a, b] = openingAcross(o, direction)
      return a < s && s < b
    })
    .map((o) => openingAlong(o, direction))
  return { section, net: subtractIntervals(section, holes) }
}

export function totalLength(intervals: [number, number][]): number {
  return intervals.reduce((sum, [a, b]) => sum + (b - a), 0)
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

/** An Opening's extent along the span axis. */
function openingAcross(o: Opening, direction: Axis): [number, number] {
  return direction === 'Y' ? [o.xMin, o.xMax] : [o.yMin, o.yMax]
}

/** An Opening's extent along the load direction (across the depth). */
function openingAlong(o: Opening, direction: Axis): [number, number] {
  return direction === 'Y' ? [o.yMin, o.yMax] : [o.xMin, o.xMax]
}

/** [lo, hi] minus the union of the holes, as sorted intervals. */
function subtractIntervals([lo, hi]: [number, number], holes: [number, number][]): [number, number][] {
  const sorted = [...holes].sort((p, q) => p[0] - q[0])
  const pieces: [number, number][] = []
  let reach = lo
  for (const [a, b] of sorted) {
    if (a > reach) pieces.push([reach, Math.min(a, hi)])
    reach = Math.max(reach, b)
    if (reach >= hi) break
  }
  if (reach < hi) pieces.push([reach, hi])
  return pieces.filter(([a, b]) => b - a > EPS)
}
