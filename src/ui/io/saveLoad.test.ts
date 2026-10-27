import { describe, expect, it } from 'vitest'
import { analyze } from '../../engine/analyze'
import { allFixtures, t1, t5 } from '../../model/fixtures'
import {
  AUTOSAVE_KEY,
  loadAutosave,
  parseProjectFile,
  projectFileName,
  serializeProject,
  writeAutosave,
} from './saveLoad'

/** In-memory Storage; optionally refuses values longer than `limit` characters, like a full quota. */
function memoryStorage(limit = Infinity): Storage {
  const items = new Map<string, string>()
  return {
    get length() {
      return items.size
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => {
      if (value.length > limit) throw new DOMException('quota exceeded', 'QuotaExceededError')
      items.set(key, value)
    },
  }
}

describe('project file (B4.2)', () => {
  it('every fixture round-trips through serialize → parse unchanged', () => {
    for (const [name, make] of Object.entries(allFixtures)) {
      const parsed = parseProjectFile(serializeProject(make()))
      expect(parsed, name).toEqual({ ok: true, project: make() })
    }
  })

  it('a loaded file gives the same results as the original', () => {
    const parsed = parseProjectFile(serializeProject(t5()))
    expect(parsed.ok && analyze(parsed.project)).toEqual(analyze(t5()))
  })

  it('rejects bad JSON', () => {
    expect(parseProjectFile('{ not json')).toEqual({ ok: false, error: 'This file is not valid JSON.' })
  })

  it('rejects a wrong version', () => {
    const file = serializeProject({ ...t1(), version: 2 as 1 })
    expect(parseProjectFile(file)).toEqual({
      ok: false,
      error: 'This is not a Lateral Load Path project: unsupported version 2 (expected 1).',
    })
  })

  it('rejects random JSON and incomplete projects, saying what is wrong', () => {
    const error = (value: unknown) => {
      const parsed = parseProjectFile(JSON.stringify(value))
      return parsed.ok ? 'accepted' : parsed.error
    }
    expect(error({ hello: 'world' })).toMatch(/unsupported version/)
    expect(error([1, 2, 3])).toMatch(/does not contain a project/)
    expect(error({ ...t1(), levels: [] })).toMatch(/no Levels/)
    const noOutline = t1() as unknown as { levels: Record<string, unknown>[] }
    delete noOutline.levels[0].outline
    expect(error(noOutline)).toMatch(/Roof has no valid outline/)
    const badLine = t1()
    ;(badLine.levels[0].shearLines[0] as { direction: string }).direction = 'Z'
    expect(error(badLine)).toMatch(/Roof has an incomplete Shear Line/)
  })

  it('names the file after the project, without characters Windows rejects', () => {
    expect(projectFileName({ ...t1(), name: 'Warehouse A/B: phase 2' })).toBe('Warehouse A-B- phase 2.lateral.json')
    expect(projectFileName({ ...t1(), name: '  ' })).toBe('project.lateral.json')
  })
})

describe('autosave (B4.2)', () => {
  it('saves and restores the project', () => {
    const storage = memoryStorage()
    expect(writeAutosave(t5(), storage)).toBe('saved')
    expect(loadAutosave(storage)).toEqual(t5())
  })

  it('returns null when there is nothing saved or the save is unreadable', () => {
    const storage = memoryStorage()
    expect(loadAutosave(storage)).toBeNull()
    storage.setItem(AUTOSAVE_KEY, '{ broken')
    expect(loadAutosave(storage)).toBeNull()
    expect(loadAutosave(undefined)).toBeNull()
  })

  it('drops Underlays when storage is full, and keeps everything else', () => {
    const project = t1()
    project.levels[0].underlay = {
      dataUrl: `data:image/png;base64,${'A'.repeat(50_000)}`,
      widthPx: 800,
      heightPx: 600,
      ftPerPx: 0.125,
      x: 0,
      y: 0,
      opacity: 0.5,
    }
    const storage = memoryStorage(20_000)
    expect(writeAutosave(project, storage)).toBe('saved-without-underlays')
    const restored = loadAutosave(storage)!
    expect(restored.levels[0].underlay).toBeUndefined()
    expect(restored.levels[0].shearLines).toEqual(project.levels[0].shearLines)
  })

  it('reports failure when even the plain project does not fit', () => {
    expect(writeAutosave(t1(), memoryStorage(10))).toBe('failed')
    expect(writeAutosave(t1(), undefined)).toBe('failed')
  })
})
