// Warnings and errors per Level (docs/spec.md §5.13). Raised once per Level and direction,
// not per Load Case.

import { checkOutline } from '../model/outline'
import type { Axis, Level } from '../model/project'
import type { Warning } from '../model/results'
import { overhangs, shearLinesIn } from './diaphragm'
import { extentOf, levelSections } from './sections'

/** SDPWS §4.2.6 cantilever limit used for the Overhang warning. */
const OVERHANG_WARN_FT = 6

export function levelWarnings(level: Level): Warning[] {
  const check = checkOutline(level.outline)
  if (!check.ok) {
    return [{ severity: 'error', code: 'outline-invalid', levelId: level.id, message: `${level.name}: ${check.message}` }]
  }

  const warnings: Warning[] = []
  for (const direction of ['X', 'Y'] as Axis[]) {
    const lines = shearLinesIn(level, direction)
    if (lines.length < 2) {
      warnings.push({
        severity: 'error',
        code: 'too-few-lines',
        levelId: level.id,
        message: `${level.name}: needs at least two Shear Lines in ${direction}, so there are no ${direction}-direction results.`,
      })
      continue
    }
    const extent = extentOf(levelSections(level, direction).gross)
    if (!extent) continue
    const { before, after } = overhangs(lines, extent)
    for (const [length, line] of [
      [before, lines[0]],
      [after, lines[lines.length - 1]],
    ] as const) {
      if (length > OVERHANG_WARN_FT) {
        warnings.push({
          severity: 'warning',
          code: 'overhang-long',
          levelId: level.id,
          refId: line.id,
          message: `${level.name}: ${length.toFixed(1)} ft Overhang beyond Shear Line ${line.name} (over ${OVERHANG_WARN_FT} ft; check SDPWS §4.2.6).`,
        })
      }
    }
  }

  if (level.openings.length > 0) {
    warnings.push({
      severity: 'warning',
      code: 'opening-chords',
      levelId: level.id,
      message: `${level.name}: chord forces around Openings are not calculated.`,
    })
  }
  return warnings
}
