import { t1 } from './fixtures'
import type { Project } from './project'

export function newId(): string {
  return crypto.randomUUID()
}

/** The project the app opens with when there is no autosave: fixture T1, so results show right away. */
export function createDefaultProject(): Project {
  const project = t1()
  project.name = 'New project'
  return project
}
