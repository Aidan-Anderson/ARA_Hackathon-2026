// Track B (B4.1): adding and deleting Levels (spec §6.4).

import { newId } from '../../model/defaults'
import type { Level, Project } from '../../model/project'

/**
 * Add a Level on top: a deep copy of the top Level (Shear Lines, Openings, Underlay) with new ids
 * for everything, named "Level n". Returns the new Level's id so the caller can select it.
 */
export function addLevelOnTop(project: Project): { project: Project; levelId: string } {
  const top = project.levels[project.levels.length - 1]
  const copy: Level = {
    ...structuredClone(top),
    id: newId(),
    name: `Level ${project.levels.length + 1}`,
  }
  copy.shearLines = copy.shearLines.map((line) => ({
    ...line,
    id: newId(),
    lateralElements: line.lateralElements.map((element) => ({ ...element, id: newId() })),
  }))
  copy.openings = copy.openings.map((opening) => ({ ...opening, id: newId() }))
  return { project: { ...project, levels: [...project.levels, copy] }, levelId: copy.id }
}

/** Delete a Level, unless it is the only one. */
export function deleteLevel(project: Project, levelId: string): Project {
  if (project.levels.length <= 1) return project
  return { ...project, levels: project.levels.filter((level) => level.id !== levelId) }
}

/** The Level below the given one, or null for the bottom Level. */
export function levelBelow(project: Project, levelId: string): Level | null {
  const index = project.levels.findIndex((level) => level.id === levelId)
  return index > 0 ? project.levels[index - 1] : null
}
