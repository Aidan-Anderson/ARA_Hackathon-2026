// Warnings and errors per Level (docs/spec.md §5.13). Raised once per Level and direction,
// not per Load Case.

import { shearLineExtent } from '../model/geometry'
import { checkOutline } from '../model/outline'
import type { Axis, Level, Project, ShearLine } from '../model/project'
import type { Warning } from '../model/results'
import { clippedElements } from './collectors'
import { overhangs, shearLinesIn } from './diaphragm'
import { continuation } from './levels'
import { diaphragmBands, supportsBand } from './bands'
import { cutAt, extentOf, levelSections } from './sections'

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
    warnings.push(...stripWarnings(level, direction, lines))

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

/**
 * Shear Lines that stop at a Level whose Diaphragm below doesn't reach them: their Transfer Force
 * has nowhere to land, so it is skipped (spec §5.10). Levels with invalid outlines are skipped.
 */
export function transferWarnings(project: Project, invalid: Set<string | undefined>): Warning[] {
  const warnings: Warning[] = []
  for (let i = 1; i < project.levels.length; i++) {
    const level = project.levels[i]
    const below = project.levels[i - 1]
    if (invalid.has(level.id) || invalid.has(below.id)) continue
    for (const line of level.shearLines) {
      if (continuation(line, below) || cutAt(below, line.direction, line.position)) continue
      warnings.push({
        severity: 'error',
        code: 'transfer-outside',
        levelId: level.id,
        refId: line.id,
        message: `${level.name}: Shear Line ${line.name} stops here, but the ${below.name} Diaphragm doesn't reach it, so its Transfer Force is not calculated.`,
      })
    }
  }
  return warnings
}

/** Lateral Elements that stick out past the line (they get clipped), and lines with none at all. */
function lineWarnings(level: Level, line: ShearLine): Warning[] {
  const section = shearLineExtent(level.outline, line) // its own extent if shortened
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

/** Strips of Diaphragm that no Shear Line supports once some lines are shortened (ADR 0002). */
function stripWarnings(level: Level, direction: Axis, lines: ShearLine[]): Warning[] {
  const bands = diaphragmBands(level, direction, lines)
  if (bands.length === 1) return []
  const across = direction === 'Y' ? 'y' : 'x'
  return bands
    .filter((band) => extentOf(levelSections(level, direction, band).gross) && !lines.some((line) => supportsBand(level, line, band)))
    .map((band) => ({
      severity: 'error' as const,
      code: 'unsupported-strip' as const,
      levelId: level.id,
      message: `${level.name}: no ${direction} Shear Line covers the Diaphragm between ${across} = ${band[0].toFixed(1)} and ${band[1].toFixed(1)} ft, so that strip's load has nowhere to go. Lengthen a line to cover it.`,
    }))
}
