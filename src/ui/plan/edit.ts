// Track B: immutable edits to the plan model made by the plan view tools and forms.

import { newId } from '../../model/defaults'
import { crossSection } from '../../model/geometry'
import type { Axis, Grid, LateralElement, Level, Point, Project } from '../../model/project'
import type { Hit } from './hitTest'

/** Openings smaller than this in either direction (after clipping) are ignored. */
const MIN_OPENING_FT = 0.5

/** Two Shear Lines closer than this in the same direction are the same line. */
const SAME_LINE_FT = 0.01

export function updateLevel(project: Project, levelId: string, change: (level: Level) => Level): Project {
  return { ...project, levels: project.levels.map((level) => (level.id === levelId ? change(level) : level)) }
}

export function setGrid(project: Project, grid: Grid): Project {
  return { ...project, grid }
}

export function setOutline(project: Project, levelId: string, outline: Point[]): Project {
  return updateLevel(project, levelId, (level) => ({ ...level, outline }))
}

/**
 * Add a Shear Line, with one Lateral Element over its full length so results appear right away
 * (spec §9 item 15). Returns the project unchanged if the Level already has that line.
 */
export function addShearLine(
  project: Project,
  levelId: string,
  line: { name: string; direction: Axis; position: number },
  kind: LateralElement['kind'] = 'shearWall',
): Project {
  return updateLevel(project, levelId, (level) => {
    const exists = level.shearLines.some(
      (other) => other.direction === line.direction && Math.abs(other.position - line.position) < SAME_LINE_FT,
    )
    if (exists) return level
    const section = crossSection(level.outline, line.direction, line.position)
    const lateralElements: LateralElement[] = section ? [{ id: newId(), kind, start: section[0], end: section[1] }] : []
    return { ...level, shearLines: [...level.shearLines, { id: newId(), ...line, lateralElements }] }
  })
}

/**
 * Add an Opening spanning corners a and b, clipped to the outline's bounding box (B2.2).
 * Returns the project unchanged if what's left is too small.
 */
export function addOpening(project: Project, levelId: string, a: Point, b: Point): Project {
  return updateLevel(project, levelId, (level) => {
    const xs = level.outline.map((p) => p.x)
    const ys = level.outline.map((p) => p.y)
    const xMin = Math.max(Math.min(a.x, b.x), Math.min(...xs))
    const xMax = Math.min(Math.max(a.x, b.x), Math.max(...xs))
    const yMin = Math.max(Math.min(a.y, b.y), Math.min(...ys))
    const yMax = Math.min(Math.max(a.y, b.y), Math.max(...ys))
    if (xMax - xMin < MIN_OPENING_FT || yMax - yMin < MIN_OPENING_FT) return level
    return { ...level, openings: [...level.openings, { id: newId(), xMin, yMin, xMax, yMax }] }
  })
}

/** Remove a Shear Line (with its Lateral Elements), a Lateral Element, or an Opening. */
export function removeItem(project: Project, levelId: string, hit: Hit): Project {
  return updateLevel(project, levelId, (level) => {
    switch (hit.kind) {
      case 'shearLine':
        return { ...level, shearLines: level.shearLines.filter((line) => line.id !== hit.id) }
      case 'lateralElement':
        return {
          ...level,
          shearLines: level.shearLines.map((line) =>
            line.id === hit.lineId ? { ...line, lateralElements: line.lateralElements.filter((e) => e.id !== hit.id) } : line,
          ),
        }
      case 'opening':
        return { ...level, openings: level.openings.filter((opening) => opening.id !== hit.id) }
    }
  })
}
