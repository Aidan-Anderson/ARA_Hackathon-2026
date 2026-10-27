// Strips of Diaphragm for shortened Shear Lines (ADR 0002). A shortened line supports only the
// strip it covers, so the Diaphragm is cut into strips across the depth at the ends of shortened
// lines. Each strip is a simple beam between the lines that cover it. Full-depth lines support
// every strip. With no shortened lines there is one strip and nothing changes.

import { isShortened, shearLineExtent } from '../model/geometry'
import type { Axis, Level, Point, ShearLine } from '../model/project'
import { uniqueSorted } from './math'

const COVER_TOLERANCE = 1e-6

/** The strips across the depth, as [from, to] in ft (y for loads in Y, x for loads in X). */
export function diaphragmBands(level: Level, direction: Axis, lines: ShearLine[]): [number, number][] {
  const depth = (p: Point) => (direction === 'Y' ? p.y : p.x)
  const lo = Math.min(...level.outline.map(depth))
  const hi = Math.max(...level.outline.map(depth))
  const cuts = lines
    .filter((line) => isShortened(level.outline, line))
    .flatMap((line) => shearLineExtent(level.outline, line) ?? [])
    .filter((t) => t > lo + COVER_TOLERANCE && t < hi - COVER_TOLERANCE)
  const breaks = uniqueSorted([lo, ...cuts, hi])
  return breaks.slice(1).map((to, i) => [breaks[i], to])
}

/** A full-depth line supports every strip; a shortened line only the strips it covers. */
export function supportsBand(level: Level, line: ShearLine, band: [number, number]): boolean {
  if (!isShortened(level.outline, line)) return true
  const extent = shearLineExtent(level.outline, line)
  return !!extent && extent[0] <= band[0] + COVER_TOLERANCE && extent[1] >= band[1] - COVER_TOLERANCE
}

/** The share of a stopped line's Transfer Force that lands in each strip: by how much of it overlaps. */
export function transferShares(span: [number, number] | null, bands: [number, number][]): number[] {
  if (bands.length === 1) return [1]
  const length = span ? span[1] - span[0] : 0
  if (!span || length <= COVER_TOLERANCE) {
    // No usable extent: all of it goes to the strip at the middle of the Diaphragm.
    const middle = (bands[0][0] + bands[bands.length - 1][1]) / 2
    return bands.map(([a, b]) => (middle >= a && middle < b ? 1 : 0))
  }
  return bands.map(([a, b]) => Math.max(0, Math.min(b, span[1]) - Math.max(a, span[0])) / length)
}
