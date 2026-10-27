// Warnings and errors per Level (docs/spec.md §5.13). Raised once per Level and direction,
// not per Load Case.

import { crossSection } from '../model/geometry'
import { checkOutline } from '../model/outline'
import type { Axis, Level, ShearLine } from '../model/project'
import type { Warning } from '../model/results'
import { clippedElements } from './collectors'
import { overhangs, shearLinesIn } from './diaphragm'
import { extentOf, levelSections } from './sections'

/** SDPWS §4.2.6 cantilever limit used for the Overhang warning. */
const OVERHANG_WARN_FT = 6
/** Lateral Elements may overshoot the line this much (drawing slop) before a warning. */
const LINE_TOLERANCE = 0.01

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
    for (const line of lines) warnings.push(...lineWarnings(level, line))

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

/** Lateral Elements that stick out past the line (they get clipped), and lines with none at all. */
function lineWarnings(level: Level, line: ShearLine): Warning[] {
  const section = crossSection(level.outline, line.direction, line.position)
  if (!section) return []
  const warnings: Warning[] = []
  const [lo, hi] = section
  for (const element of line.lateralElements) {
    if (element.start < lo - LINE_TOLERANCE || element.end > hi + LINE_TOLERANCE) {
      warnings.push({
        severity: 'warning',
        code: 'element-off-line',
        levelId: level.id,
        refId: element.id,
        message: `${level.name}: a Lateral Element on Shear Line ${line.name} extends past the line's ${(hi - lo).toFixed(1)} ft length; only the part on the line counts.`,
      })
    }
  }
  if (clippedElements(line, section).every((element) => element.length <= LINE_TOLERANCE)) {
    warnings.push({
      severity: 'warning',
      code: 'line-without-elements',
      levelId: level.id,
      refId: line.id,
      message: `${level.name}: Shear Line ${line.name} has no Lateral Elements, so its reaction has nowhere to go.`,
    })
  }
  return warnings
}
