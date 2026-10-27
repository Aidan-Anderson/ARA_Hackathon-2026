// Track B (B3.2): helpers for drawing results on the plan: number formats, the plf color scale,
// and where Collector and span diagrams go.

import type { Axis, Level, Point, ShearLine } from '../../model/project'

/** Collector diagrams are scaled so the largest on the Level sticks out this far from its line. */
export const COLLECTOR_DIAGRAM_FT = 8

/** Kips for plan labels: 3 significant figures, e.g. 9.36, 13.0, 140. */
export function kips(value: number): string {
  const magnitude = Math.abs(value)
  return magnitude >= 100 ? value.toFixed(0) : magnitude >= 10 ? value.toFixed(1) : value.toFixed(2)
}

export function plf(value: number): string {
  return value.toFixed(0)
}

/** Lateral Element color by unit shear relative to the highest on the Level: purple (low) to red (high). */
export function utilizationColor(fraction: number): string {
  const t = Math.min(Math.max(fraction, 0), 1)
  const low = [196, 177, 245]
  const high = [207, 34, 46]
  const mix = low.map((c, i) => Math.round(c + (high[i] - c) * t))
  return `rgb(${mix.join(' ')})`
}

/** A point beside a Shear Line: t along it, offset ft to the +x side (Y-lines) or +y side (X-lines). */
export function besideLine(line: Pick<ShearLine, 'direction' | 'position'>, t: number, offset: number): Point {
  return line.direction === 'Y' ? { x: line.position + offset, y: t } : { x: t, y: line.position + offset }
}

/** The plan polygon of a Collector diagram: from the line out to F(t) × scale and back. */
export function collectorPolygon(
  line: Pick<ShearLine, 'direction' | 'position'>,
  force: { s: number[]; v: number[] },
  ftPerKip: number,
): Point[] {
  if (force.s.length === 0) return []
  const first = force.s[0]
  const last = force.s[force.s.length - 1]
  return [
    besideLine(line, first, 0),
    ...force.s.map((t, i) => besideLine(line, t, force.v[i] * ftPerKip)),
    besideLine(line, last, 0),
  ]
}

/** Index of the largest |value|, or -1 if there are none. */
export function indexOfMaxAbs(values: number[]): number {
  let best = -1
  values.forEach((value, i) => {
    if (best < 0 || Math.abs(value) > Math.abs(values[best])) best = i
  })
  return best
}

/** The Lateral Element and its Shear Line, by element id. */
export function findElement(level: Level, elementId: string) {
  for (const line of level.shearLines) {
    const element = line.lateralElements.find((e) => e.id === elementId)
    if (element) return { line, element }
  }
  return null
}

/** For a load in `direction`, spans run along x (Y-loads) or y (X-loads). */
export function spanAxis(direction: Axis): 'x' | 'y' {
  return direction === 'Y' ? 'x' : 'y'
}
