// Track B: immutable edits to the plan model made by the plan view tools and forms.

import { newId } from '../../model/defaults'
import { crossSection } from '../../model/geometry'
import type { Axis, Grid, LateralElement, Level, Point, Project } from '../../model/project'

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
