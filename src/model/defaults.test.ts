import { describe, expect, it } from 'vitest'
import { createDefaultProject, newId } from './defaults'
import { t1 } from './fixtures'

describe('createDefaultProject', () => {
  it('is fixture T1 under a new name', () => {
    expect({ ...createDefaultProject(), name: t1().name }).toEqual(t1())
  })

  it('returns an independent copy each call', () => {
    const a = createDefaultProject()
    const b = createDefaultProject()
    a.levels[0].seismic.fxPsf = 99
    a.loads.windPlf.Y = 99
    expect(b.levels[0].seismic.fxPsf).toBe(5.2)
    expect(b.loads.windPlf.Y).toBe(0)
  })
})

describe('newId', () => {
  it('is unique', () => {
    expect(newId()).not.toBe(newId())
  })
})
