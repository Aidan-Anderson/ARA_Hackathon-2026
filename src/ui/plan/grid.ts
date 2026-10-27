// Track B: Gridlines from the Grid spacings, and the Grid-mode edits (spec §6.2, §6.4, §9 items 1 and 15).

import { newId } from '../../model/defaults'
import { crossSection } from '../../model/geometry'
import type { Axis, Grid, Level, Point, ShearLine } from '../../model/project'

/** A Gridline, described the way a Shear Line on it would be. */
export interface Gridline {
  /** "1", "2", … for numbered Gridlines; "A", "B", … for lettered ones. */
  name: string
  /** Numbered Gridlines are vertical, so a Shear Line on one is a Y-line; lettered ones give X-lines. */
  direction: Axis
  /** ft: x for numbered Gridlines, y for lettered ones. */
  position: number
}

/** Numbered Gridlines left → right, then lettered Gridlines bottom → top. Gridlines 1 and A are at 0. */
export function gridlines(grid: Grid): Gridline[] {
  return [
    ...offsets(grid.xSpacings).map((position, i): Gridline => ({ name: String(i + 1), direction: 'Y', position })),
    ...offsets(grid.ySpacings).map((position, i): Gridline => ({ name: gridLetter(i), direction: 'X', position })),
  ]
}

/** The far Gridlines: x of the last numbered one, y of the last lettered one. */
export function gridExtents(grid: Grid): Point {
  return { x: offsets(grid.xSpacings)[grid.xSpacings.length], y: offsets(grid.ySpacings)[grid.ySpacings.length] }
}

/** "Outline = grid extents": a counter-clockwise rectangle from Gridlines 1 and A to the last Gridlines. */
export function gridOutline(grid: Grid): Point[] {
  const { x, y } = gridExtents(grid)
  return [
    { x: 0, y: 0 },
    { x, y: 0 },
    { x, y },
    { x: 0, y },
  ]
}

/**
 * Reads spacings typed as a list, such as "20, 20, 30, 30" (spaces also separate).
 * Returns null unless there is at least one entry and every entry is a positive number.
 */
export function parseSpacings(text: string): number[] | null {
  const spacings = text
    .split(/[\s,]+/)
    .filter((entry) => entry !== '')
    .map((entry) => Number(entry))
  return spacings.length > 0 && spacings.every((spacing) => Number.isFinite(spacing) && spacing > 0) ? spacings : null
}

/** True if the Level already has a Shear Line on this Gridline. */
export function hasShearLineOn(level: Level, gridline: Gridline): boolean {
  return level.shearLines.some(
    (line) => line.direction === gridline.direction && Math.abs(line.position - gridline.position) < 1e-6,
  )
}

/**
 * The Shear Line tool in Grid mode: adds a Shear Line on the Gridline, named after it, with one Lateral
 * Element over its full length (spec §9 item 15). A Gridline that misses the outline gets no element.
 * Returns the Level itself if the Gridline already has a Shear Line.
 */
export function addShearLineOnGridline(level: Level, gridline: Gridline): Level {
  if (hasShearLineOn(level, gridline)) return level
  const extent = crossSection(level.outline, gridline.direction, gridline.position)
  const line: ShearLine = {
    id: newId(),
    name: gridline.name,
    direction: gridline.direction,
    position: gridline.position,
    lateralElements:
      extent && extent[1] > extent[0] ? [{ id: newId(), kind: 'shearWall', start: extent[0], end: extent[1] }] : [],
  }
  return { ...level, shearLines: [...level.shearLines, line] }
}

/** 0, then the running sums of the spacings, rounded so 0.1 + 0.2 gives 0.3. */
function offsets(spacings: number[]): number[] {
  const result = [0]
  for (const spacing of spacings) result.push(Math.round((result[result.length - 1] + spacing) * 1e6) / 1e6)
  return result
}

/** 0 → A, 25 → Z, 26 → AA, 27 → AB, … */
function gridLetter(index: number): string {
  let name = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  return name
}
