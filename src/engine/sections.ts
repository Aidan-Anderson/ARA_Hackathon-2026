// Diaphragm cross-sections along the span axis (docs/spec.md §5.2).
// A1.1: gross depth only. A2.2 adds net depth, Openings, and left/right values at jumps.

import { crossSection } from '../model/geometry'
import type { Axis, Point } from '../model/project'

/** A stretch of the span axis where the Diaphragm depth is constant. */
export interface DepthPiece {
  from: number
  to: number
  depth: number
}

/**
 * Gross Diaphragm depth along the span axis, for load in `direction`.
 * For SY the span axis is x and depth is measured in y; for SX they swap.
 */
export function depthPieces(outline: Point[], direction: Axis): DepthPiece[] {
  const across = direction === 'Y' ? (p: Point) => p.x : (p: Point) => p.y
  const breaks = [...new Set(outline.map(across))].sort((a, b) => a - b)
  const pieces: DepthPiece[] = []
  for (let i = 0; i + 1 < breaks.length; i++) {
    const section = crossSection(outline, direction, (breaks[i] + breaks[i + 1]) / 2)
    if (section) pieces.push({ from: breaks[i], to: breaks[i + 1], depth: section[1] - section[0] })
  }
  return pieces
}

/** Plan area of an outline (sf). */
export function outlineArea(outline: Point[]): number {
  let twice = 0
  outline.forEach((a, i) => {
    const b = outline[(i + 1) % outline.length]
    twice += a.x * b.y - b.x * a.y
  })
  return Math.abs(twice) / 2
}
