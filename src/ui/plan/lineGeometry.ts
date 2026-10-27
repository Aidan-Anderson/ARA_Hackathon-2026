// Track B: where Shear Lines sit on the plan, for drawing and hit-testing.

import { crossSection } from '../../model/geometry'
import type { Level, Point, ShearLine } from '../../model/project'
import type { Bounds } from './viewport'

/** Where a Shear Line is drawn: its Diaphragm cross-section, or across the plan if it misses the outline. */
export function lineExtent(level: Level, line: ShearLine, bounds: Bounds): [number, number] {
  return (
    crossSection(level.outline, line.direction, line.position) ??
    (line.direction === 'Y' ? [bounds.yMin, bounds.yMax] : [bounds.xMin, bounds.xMax])
  )
}

/** The plan point at distance t along a Shear Line. */
export function alongLine(line: ShearLine, t: number): Point {
  return line.direction === 'Y' ? { x: line.position, y: t } : { x: t, y: line.position }
}
