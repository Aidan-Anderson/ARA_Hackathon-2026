// Story Force F_x, seismic weight, and Diaphragm Force F_px for each Level (docs/spec.md §5.3–5.4).

import type { Loads, Project } from '../model/project'
import type { FpxResult } from '../model/results'
import { outlineArea } from './sections'

export interface LevelForces {
  /** sf */
  netArea: number
  /** kips */
  fx: number
  /** kips */
  weight: number
  fpx: FpxResult
}

/** Forces for every Level, in project order (bottom → top). The same in X and Y. */
export function levelForces(project: Project): LevelForces[] {
  const base = project.levels.map((level) => {
    const netArea = outlineArea(level.outline)
    return {
      netArea,
      fx: (level.seismic.fxPsf / 1000) * netArea,
      weight: (level.seismic.weightPsf / 1000) * netArea,
    }
  })
  return base.map((level, i) => ({ ...level, fpx: diaphragmForce(level, base.slice(i), project.loads) }))
}

/**
 * F_px per ASCE 7 §12.10.1.1, with the design value max(F_x, F_px).
 * `atAndAbove` is this Level and every Level above it.
 */
function diaphragmForce(
  level: { fx: number; weight: number },
  atAndAbove: { fx: number; weight: number }[],
  loads: Loads,
): FpxResult {
  const sumF = atAndAbove.reduce((sum, l) => sum + l.fx, 0)
  const sumW = atAndAbove.reduce((sum, l) => sum + l.weight, 0)
  const raw = sumW > 0 ? (sumF / sumW) * level.weight : 0
  const min = 0.2 * loads.sds * loads.ie * level.weight
  const max = 0.4 * loads.sds * loads.ie * level.weight

  let fpx = raw
  let governs: FpxResult['governs'] = 'equation'
  if (raw < min) {
    fpx = min
    governs = 'min'
  } else if (raw > max) {
    fpx = max
    governs = 'max'
  }
  // Tolerance keeps F_x = F_px (e.g. a roof) reported as 'equation' despite float noise.
  if (level.fx - fpx > 1e-9) governs = 'fx'
  return { raw, min, max, fpx, design: Math.max(level.fx, fpx), governs }
}
