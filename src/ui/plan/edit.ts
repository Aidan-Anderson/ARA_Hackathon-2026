// Track B: immutable Project updates shared by the plan and the Load form (spec §4.2: every edit makes a new project).

import type { Level, Project } from '../../model/project'
import { currentLevel } from '../../model/ui'

/** Replaces the Level shown on the plan (see currentLevel) with change(level). Returns `project` itself if nothing changed. */
export function updateLevel(project: Project, levelId: string, change: (level: Level) => Level): Project {
  const target = currentLevel(project, levelId)
  const changed = change(target)
  if (changed === target) return project
  return { ...project, levels: project.levels.map((level) => (level === target ? changed : level)) }
}
