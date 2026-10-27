// Track B: Gridlines (spec §6.2). Numbered Gridlines 1, 2, 3… run vertically and are spaced along x;
// lettered Gridlines A, B, C… run horizontally and are spaced along y. Gridline 1 / A is the origin.

import type { Axis, Grid, Point } from '../../model/project'

export interface Gridline {
  label: string
  /** Like a Shear Line: 'Y' is a vertical Gridline at x = position, 'X' a horizontal one at y = position. */
  direction: Axis
  position: number
}

/** Letters as used on drawings: I and O are skipped so they aren't mistaken for 1 and 0. */
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

/** 0 → A, 23 → Z, 24 → AA, 25 → AB, … */
export function letterLabel(index: number): string {
  let label = ''
  let n = index
  do {
    label = LETTERS[n % LETTERS.length] + label
    n = Math.floor(n / LETTERS.length) - 1
  } while (n >= 0)
  return label
}

export function gridlines(grid: Grid): Gridline[] {
  const positions = (spacings: number[]) => spacings.reduce((acc, spacing) => [...acc, acc[acc.length - 1] + spacing], [0])
  return [
    ...positions(grid.xSpacings).map((x, i) => ({ label: String(i + 1), direction: 'Y' as const, position: x })),
    ...positions(grid.ySpacings).map((y, i) => ({ label: letterLabel(i), direction: 'X' as const, position: y })),
  ]
}

/** "20, 20, 30" or "3@20, 30" → spacings in ft. Empty text → []. Anything unreadable → null. */
export function parseSpacings(text: string): number[] | null {
  const tokens = text.split(/[,\s]+/).filter(Boolean)
  const spacings: number[] = []
  for (const token of tokens) {
    const [count, value] = token.includes('@') ? token.split('@') : ['1', token]
    const n = Number(count)
    const spacing = Number(value)
    if (!Number.isInteger(n) || n < 1 || !(spacing > 0) || !Number.isFinite(spacing)) return null
    for (let i = 0; i < n; i++) spacings.push(spacing)
  }
  return spacings
}

export function formatSpacings(spacings: number[]): string {
  return spacings.join(', ')
}

/** The rectangle spanning the whole grid, counter-clockwise, or null if a direction has no spacings. */
export function gridRectangle(grid: Grid): Point[] | null {
  const width = grid.xSpacings.reduce((sum, s) => sum + s, 0)
  const depth = grid.ySpacings.reduce((sum, s) => sum + s, 0)
  if (!(width > 0) || !(depth > 0)) return null
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: depth },
    { x: 0, y: depth },
  ]
}

/** The Gridline closest to p, if it is within `tolerance` ft. */
export function nearestGridline(lines: Gridline[], p: Point, tolerance: number): Gridline | null {
  let best: Gridline | null = null
  let bestDistance = tolerance
  for (const line of lines) {
    const distance = Math.abs((line.direction === 'Y' ? p.x : p.y) - line.position)
    if (distance <= bestDistance) {
      best = line
      bestDistance = distance
    }
  }
  return best
}
