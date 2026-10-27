// Track B (B4.2): the project file and the browser autosave (spec §6.6).
// The file is the plan model itself (spec §4.3), pretty-printed.

import type { Project } from '../../model/project'

export const AUTOSAVE_KEY = 'hackathon2026.project'

export type ParseResult = { ok: true; project: Project } | { ok: false; error: string }

export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2)
}

/** `<name>.lateral.json`, with characters Windows won't accept in file names replaced. */
export function projectFileName(project: Project): string {
  const safe = project.name.replace(/[\\/:*?"<>|]+/g, '-').trim()
  return `${safe || 'project'}.lateral.json`
}

/** Parse a project file, checking the version and the shape the engine relies on. */
export function parseProjectFile(text: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' }
  }
  const problem = projectProblem(data)
  return problem ? { ok: false, error: `This is not a Lateral Load Path project: ${problem}` } : { ok: true, project: data as Project }
}

/** The first thing wrong with `data` as a Project, or null if it looks right. */
function projectProblem(data: unknown): string | null {
  if (!isObject(data)) return 'the file does not contain a project.'
  if (data.version !== 1) return `unsupported version ${JSON.stringify(data.version)} (expected 1).`
  if (typeof data.name !== 'string') return 'the project name is missing.'
  if (!isObject(data.grid) || !Array.isArray(data.grid.xSpacings) || !Array.isArray(data.grid.ySpacings)) {
    return 'the grid is missing.'
  }
  const { loads } = data
  if (!isObject(loads) || !numbers(loads, ['sds', 'ie', 'rho', 'omega0']) || !isObject(loads.windPlf) || !numbers(loads.windPlf, ['X', 'Y'])) {
    return 'the loads are missing or incomplete.'
  }
  if (!Array.isArray(data.levels) || data.levels.length === 0) return 'there are no Levels.'

  for (const [i, level] of data.levels.entries()) {
    const label = isObject(level) && typeof level.name === 'string' ? level.name : `Level ${i + 1}`
    if (!isObject(level) || typeof level.id !== 'string' || typeof level.storyHeight !== 'number') {
      return `${label} is incomplete.`
    }
    if (!Array.isArray(level.outline) || !level.outline.every((p) => isObject(p) && numbers(p, ['x', 'y']))) {
      return `${label} has no valid outline.`
    }
    if (!Array.isArray(level.openings)) return `${label} has no openings list.`
    if (!isObject(level.seismic) || !numbers(level.seismic, ['fxPsf', 'weightPsf'])) return `${label} has no seismic inputs.`
    if (!Array.isArray(level.shearLines)) return `${label} has no Shear Lines list.`
    for (const line of level.shearLines) {
      if (
        !isObject(line) ||
        typeof line.id !== 'string' ||
        (line.direction !== 'X' && line.direction !== 'Y') ||
        typeof line.position !== 'number' ||
        !Array.isArray(line.lateralElements)
      ) {
        return `${label} has an incomplete Shear Line.`
      }
      // A shortened line's extent is optional, but must be a real range if present (ADR 0002).
      if (
        line.extent !== undefined &&
        (!isObject(line.extent) || !numbers(line.extent, ['start', 'end']) || !((line.extent.end as number) > (line.extent.start as number)))
      ) {
        return `${label} has a Shear Line with an invalid length.`
      }
    }
  }
  return null
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function numbers(object: Record<string, unknown>, keys: string[]): boolean {
  return keys.every((key) => typeof object[key] === 'number')
}

// ---------------------------------------------------------------------------------------------
// Autosave. `storage` is injectable for tests; it is undefined outside a browser.

function browserStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined // some browsers throw when storage is blocked
  }
}

/** The autosaved project, or null if there is none or it can't be read. */
export function loadAutosave(storage: Storage | undefined = browserStorage()): Project | null {
  try {
    const text = storage?.getItem(AUTOSAVE_KEY)
    if (!text) return null
    const parsed = parseProjectFile(text)
    return parsed.ok ? parsed.project : null
  } catch {
    return null
  }
}

export type AutosaveOutcome = 'saved' | 'saved-without-underlays' | 'failed'

/** Save to browser storage. If it's full, try again without the Underlay images. */
export function writeAutosave(project: Project, storage: Storage | undefined = browserStorage()): AutosaveOutcome {
  if (!storage) return 'failed'
  try {
    storage.setItem(AUTOSAVE_KEY, serializeProject(project))
    return 'saved'
  } catch {
    try {
      const withoutUnderlays = { ...project, levels: project.levels.map(({ underlay: _underlay, ...level }) => level) }
      storage.setItem(AUTOSAVE_KEY, serializeProject(withoutUnderlays))
      return 'saved-without-underlays'
    } catch {
      return 'failed'
    }
  }
}
