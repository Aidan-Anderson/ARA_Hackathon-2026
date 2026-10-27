// Track B: where Shear Lines sit on the plan, for drawing and hit-testing.

import { shearLineExtent } from '../../model/geometry'
import type { Level, Point, ShearLine } from '../../model/project'
import type { Bounds } from './viewport'

/**
 * Where a Shear Line is drawn: its own extent within the Diaphragm cross-section (full depth unless
 * shortened, ADR 0002), or across the plan if it misses the outline.
 */
export function lineExtent(level: Level, line: ShearLine, bounds: Bounds): [number, number] {
  return (
    shearLineExtent(level.outline, line) ??
    (line.direction === 'Y' ? [bounds.yMin, bounds.yMax] : [bounds.xMin, bounds.xMax])
  )
}

/** The plan point at distance t along a Shear Line. */
export function alongLine(line: ShearLine, t: number): Point {
  return line.direction === 'Y' ? { x: line.position, y: t } : { x: t, y: line.position }
}
