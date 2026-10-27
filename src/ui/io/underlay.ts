// Track B (B5.1): placing, calibrating, and moving an imported Underlay (spec §6.7).
// Image pixels map to plan ft by ftPerPx; (x, y) is the plan position of the image's bottom-left.

import type { Point, Underlay } from '../../model/project'
import type { Bounds } from '../plan/viewport'

export interface UnderlayImage {
  dataUrl: string
  widthPx: number
  heightPx: number
}

/**
 * A freshly imported Underlay, bottom-left at (0, 0), provisionally scaled so its width matches
 * `planWidthFt`. Calibrate fixes the scale.
 */
export function placeUnderlay(image: UnderlayImage, planWidthFt: number): Underlay {
  const ftPerPx = planWidthFt > 0 && image.widthPx > 0 ? planWidthFt / image.widthPx : 0.1
  return { ...image, ftPerPx, x: 0, y: 0, opacity: 0.5 }
}

/**
 * Two points the user clicked (plan coordinates) are `distanceFt` apart in reality: rescale the
 * Underlay to match and put its bottom-left back at (0, 0). Returns null if the points coincide.
 */
export function calibrateUnderlay(underlay: Underlay, a: Point, b: Point, distanceFt: number): Underlay | null {
  const pixels = Math.hypot(b.x - a.x, b.y - a.y) / underlay.ftPerPx
  if (!(pixels > 0) || !(distanceFt > 0)) return null
  return { ...underlay, ftPerPx: distanceFt / pixels, x: 0, y: 0 }
}

export function moveUnderlay(underlay: Underlay, dx: number, dy: number): Underlay {
  return { ...underlay, x: underlay.x + dx, y: underlay.y + dy }
}

/** The Underlay's extent on the plan (ft). */
export function underlayBounds(underlay: Underlay): Bounds {
  return {
    xMin: underlay.x,
    xMax: underlay.x + underlay.widthPx * underlay.ftPerPx,
    yMin: underlay.y,
    yMax: underlay.y + underlay.heightPx * underlay.ftPerPx,
  }
}

export function insideUnderlay(underlay: Underlay, p: Point): boolean {
  const b = underlayBounds(underlay)
  return p.x >= b.xMin && p.x <= b.xMax && p.y >= b.yMin && p.y <= b.yMax
}
