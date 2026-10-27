// Track B: the plan view's mapping between model ft (y up) and screen px (y down) (spec §6.2).

import type { Grid, Level, Point } from '../../model/project'
import { gridExtents } from './grid'

/** screen x = tx + x · scale; screen y = ty − y · scale. The minus sign is the y-flip that keeps the model y-up. */
export interface View {
  /** px per ft */
  scale: number
  /** px */
  tx: number
  /** px */
  ty: number
}

/** ft */
export interface Box {
  xMin: number
  yMin: number
  xMax: number
  yMax: number
}

/** px */
export interface Size {
  width: number
  height: number
}

/** px around the fitted plan. The left and bottom leave room for the Gridline bubbles. */
export const FIT_MARGIN = { top: 40, right: 40, bottom: 64, left: 64 }

/** px per ft */
const MIN_SCALE = 0.01
const MAX_SCALE = 1000

export function toScreen(view: View, p: Point): Point {
  return { x: view.tx + p.x * view.scale, y: view.ty - p.y * view.scale }
}

/** What the plan view fits: the Grid, the outline, and every Shear Line position on the Level. */
export function contentBox(grid: Grid, level: Level): Box {
  const extents = gridExtents(grid)
  const xs = [0, extents.x, ...level.outline.map((p) => p.x)]
  const ys = [0, extents.y, ...level.outline.map((p) => p.y)]
  for (const line of level.shearLines) (line.direction === 'Y' ? xs : ys).push(line.position)
  return { xMin: Math.min(...xs), yMin: Math.min(...ys), xMax: Math.max(...xs), yMax: Math.max(...ys) }
}

/** The view that shows all of `box`, centered in `size` inside FIT_MARGIN. */
export function fitView(box: Box, size: Size): View {
  const roomX = Math.max(size.width - FIT_MARGIN.left - FIT_MARGIN.right, 1)
  const roomY = Math.max(size.height - FIT_MARGIN.top - FIT_MARGIN.bottom, 1)
  const scale = clamp(
    Math.min(roomX / Math.max(box.xMax - box.xMin, 1), roomY / Math.max(box.yMax - box.yMin, 1)),
    MIN_SCALE,
    MAX_SCALE,
  )
  return {
    scale,
    tx: FIT_MARGIN.left + roomX / 2 - ((box.xMin + box.xMax) / 2) * scale,
    ty: FIT_MARGIN.top + roomY / 2 + ((box.yMin + box.yMax) / 2) * scale,
  }
}

/** Zooms by `factor` about the screen point `at`, which stays over the same model point. */
export function zoomAt(view: View, factor: number, at: Point): View {
  const scale = clamp(view.scale * factor, MIN_SCALE, MAX_SCALE)
  const k = scale / view.scale
  return { scale, tx: at.x - (at.x - view.tx) * k, ty: at.y - (at.y - view.ty) * k }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
