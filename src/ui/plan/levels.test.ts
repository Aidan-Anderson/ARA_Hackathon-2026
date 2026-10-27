// B4.1: adding and deleting Levels, checked through analyze() against spec §7.2 (T2, T5).

import { describe, expect, it } from 'vitest'
import { analyze } from '../../engine/analyze'
import { t1 } from '../../model/fixtures'
import type { Project } from '../../model/project'
import { updateLevel } from './edit'
import { addLevelOnTop, deleteLevel, levelBelow } from './levels'

/** Build T2 the way a user would: T1, "+ Level", then the Load form values from the ticket. */
function buildT2(): Project {
  const start = t1()
  const { project } = addLevelOnTop(start)
  const [bottom, top] = project.levels
  let p = updateLevel(project, bottom.id, (l) => ({ ...l, storyHeight: 10, seismic: { fxPsf: 6, weightPsf: 40 } }))
  p = updateLevel(p, top.id, (l) => ({ ...l, storyHeight: 10, seismic: { fxPsf: 6, weightPsf: 20 } }))
  return p
}

function storyShears(project: Project, levelIndex: number): number[] {
  const level = project.levels[levelIndex]
  const lines = analyze(project).cases.SY.levels[levelIndex].lines
  return level.shearLines
    .filter((line) => line.direction === 'Y')
    .sort((a, b) => a.position - b.position)
    .map((line) => lines.find((r) => r.lineId === line.id)!.storyShear)
}

describe('Levels (B4.1)', () => {
  it('"+ Level" copies the top Level on top with new ids and the name "Level n"', () => {
    const start = t1()
    const { project, levelId } = addLevelOnTop(start)
    expect(project.levels).toHaveLength(2)
    const [bottom, top] = project.levels
    expect(top.id).toBe(levelId)
    expect(top.name).toBe('Level 2')
    expect(top.outline).toEqual(bottom.outline)
    expect(top.shearLines.map((l) => [l.name, l.position])).toEqual(bottom.shearLines.map((l) => [l.name, l.position]))

    const ids = (level: typeof top) => [
      level.id,
      ...level.shearLines.flatMap((line) => [line.id, ...line.lateralElements.map((e) => e.id)]),
      ...level.openings.map((o) => o.id),
    ]
    const bottomIds = new Set(ids(bottom))
    expect(ids(top).some((id) => bottomIds.has(id))).toBe(false)

    // A deep copy: editing the new Level leaves the one below alone.
    top.outline[0].x = 999
    expect(bottom.outline[0].x).not.toBe(999)
  })

  it('builds T2: the bottom Level’s story shear reads 12 / 30 / 18', () => {
    const shears = storyShears(buildT2(), 0)
    ;[12, 30, 18].forEach((expected, i) => expect(shears[i]).toBeCloseTo(expected, 6))
  })

  it('builds T5: deleting line 2 on the bottom Level makes a 300 plf transfer Collector at x = 40', () => {
    let p = buildT2()
    const bottom = p.levels[0]
    p = updateLevel(p, bottom.id, (l) => ({ ...l, shearLines: l.shearLines.filter((line) => line.name !== '2') }))
    const { transfersIn } = analyze(p).cases.SY.levels[0]
    expect(transfersIn).toHaveLength(1)
    expect(transfersIn[0].position).toBeCloseTo(40, 6)
    expect(transfersIn[0].collectorPlf).toBeCloseTo(300, 6)
  })

  it('deletes a Level only when there is more than one', () => {
    const one = t1()
    expect(deleteLevel(one, one.levels[0].id)).toBe(one)
    const { project, levelId } = addLevelOnTop(one)
    expect(deleteLevel(project, levelId).levels.map((l) => l.id)).toEqual([one.levels[0].id])
  })

  it('finds the Level below for the ghost', () => {
    const { project, levelId } = addLevelOnTop(t1())
    expect(levelBelow(project, levelId)?.id).toBe(project.levels[0].id)
    expect(levelBelow(project, project.levels[0].id)).toBeNull()
  })
})
