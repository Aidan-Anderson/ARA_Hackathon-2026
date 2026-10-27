// Test projects from docs/spec.md §7.2, with the expected values listed there.
// Each fixture is a function that returns a fresh Project, so tests can mutate their copy freely.

import type { Project, ShearLine } from '../project'
import { level, loads, rect, shearLine } from './build'

/** The T1 plan's Shear Lines: Y-lines 1, 2, 3 at x = 0, 40, 100 and X-lines A, B at y = 0, 50. */
function t1Lines(prefix: string, line2Element: [number, number] = [0, 20]): ShearLine[] {
  return [
    shearLine(prefix, '1', 'Y', 0, [[0, 50]]),
    shearLine(prefix, '2', 'Y', 40, [line2Element]),
    shearLine(prefix, '3', 'Y', 100, [[0, 50]]),
    shearLine(prefix, 'A', 'X', 0, [[0, 100]]),
    shearLine(prefix, 'B', 'X', 50, [[0, 100]]),
  ]
}

/** T1: single story, 100 × 50 ft rectangle. Also the default project. */
export function t1(): Project {
  return {
    version: 1,
    name: 'T1 — single story, rectangle',
    grid: { xSpacings: [40, 60], ySpacings: [50] },
    levels: [
      level({ id: 'roof', name: 'Roof', storyHeight: 16, fxPsf: 5.2, weightPsf: 24, outline: rect(100, 50), shearLines: t1Lines('roof') }),
    ],
    loads: loads(),
  }
}

/** T1b: T1 with line 2's Lateral Element moved to [15, 35]. */
export function t1b(): Project {
  const p = t1()
  p.name = 'T1b — line 2 element centered'
  p.levels[0].shearLines = t1Lines('roof', [15, 35])
  return p
}

/** T1w: T1 with 300 plf wind in Y. */
export function t1w(): Project {
  const p = t1()
  p.name = 'T1w — with wind Y'
  p.loads.windPlf.Y = 300
  return p
}

/** T2: two stories, same plan and lines stacked. */
export function t2(): Project {
  return {
    version: 1,
    name: 'T2 — two stories, stacked',
    grid: { xSpacings: [40, 60], ySpacings: [50] },
    levels: [
      level({ id: 'level-2', name: 'Level 2', storyHeight: 10, fxPsf: 6, weightPsf: 40, outline: rect(100, 50), shearLines: t1Lines('L2') }),
      level({ id: 'roof', name: 'Roof', storyHeight: 10, fxPsf: 6, weightPsf: 20, outline: rect(100, 50), shearLines: t1Lines('roof') }),
    ],
    loads: loads(),
  }
}

/** T3: L-shape (the ADR 0001 example). */
export function t3(): Project {
  return {
    version: 1,
    name: 'T3 — L-shape',
    grid: { xSpacings: [30, 30], ySpacings: [25, 25] },
    levels: [
      level({
        id: 'roof',
        name: 'Roof',
        storyHeight: 12,
        fxPsf: 10,
        weightPsf: 50,
        outline: [
          { x: 0, y: 0 },
          { x: 60, y: 0 },
          { x: 60, y: 25 },
          { x: 30, y: 25 },
          { x: 30, y: 50 },
          { x: 0, y: 50 },
        ],
        shearLines: [
          shearLine('roof', '1', 'Y', 0, [[0, 50]]),
          shearLine('roof', '3', 'Y', 60, [[0, 25]]),
          shearLine('roof', 'A', 'X', 0, [[0, 60]]),
          shearLine('roof', 'C', 'X', 50, [[0, 30]]),
        ],
      }),
    ],
    loads: loads({ sds: 0.6 }),
  }
}

/** T4: 100 × 50 rectangle with an Opening at x 10–20, y 20–30. */
export function t4(): Project {
  return {
    version: 1,
    name: 'T4 — Opening',
    grid: { xSpacings: [100], ySpacings: [50] },
    levels: [
      level({
        id: 'roof',
        name: 'Roof',
        storyHeight: 12,
        fxPsf: 10,
        weightPsf: 50,
        outline: rect(100, 50),
        shearLines: [
          shearLine('roof', '1', 'Y', 0, [[0, 50]]),
          shearLine('roof', '2', 'Y', 100, [[0, 50]]),
          shearLine('roof', 'A', 'X', 0, [[0, 100]]),
          shearLine('roof', 'B', 'X', 50, [[0, 100]]),
        ],
        openings: [{ id: 'roof-o1', xMin: 10, yMin: 20, xMax: 20, yMax: 30 }],
      }),
    ],
    loads: loads({ sds: 0.6 }),
  }
}

/** T5: T2, but Level 2 has no line at x = 40, so the Roof's line 2 transfers into Level 2. */
export function t5(): Project {
  const p = t2()
  p.name = 'T5 — Transfer Force'
  p.levels[0].shearLines = p.levels[0].shearLines.filter((line) => line.name !== '2')
  return p
}

/** T6: U outline, which checkOutline must reject. */
export function t6(): Project {
  return {
    version: 1,
    name: 'T6 — U outline (invalid)',
    grid: { xSpacings: [20, 20, 20], ySpacings: [20, 30] },
    levels: [
      level({
        id: 'roof',
        name: 'Roof',
        storyHeight: 12,
        fxPsf: 10,
        weightPsf: 50,
        outline: [
          { x: 0, y: 0 },
          { x: 60, y: 0 },
          { x: 60, y: 50 },
          { x: 40, y: 50 },
          { x: 40, y: 20 },
          { x: 20, y: 20 },
          { x: 20, y: 50 },
          { x: 0, y: 50 },
        ],
        shearLines: [
          shearLine('roof', '1', 'Y', 0, [[0, 50]]),
          shearLine('roof', '4', 'Y', 60, [[0, 50]]),
          shearLine('roof', 'A', 'X', 0, [[0, 60]]),
        ],
      }),
    ],
    loads: loads({ sds: 0.6 }),
  }
}

/** T6b: T1 with only line 1 in Y, which gives too-few-lines for SY. */
export function t6b(): Project {
  const p = t1()
  p.name = 'T6b — one Y line'
  p.levels[0].shearLines = p.levels[0].shearLines.filter((line) => line.direction === 'X' || line.name === '1')
  return p
}

/** T7: 100 × 50 rectangle with Y-lines at x = 0 and 90, leaving a 10 ft Overhang. */
export function t7(): Project {
  return {
    version: 1,
    name: 'T7 — Overhang',
    grid: { xSpacings: [90, 10], ySpacings: [50] },
    levels: [
      level({
        id: 'roof',
        name: 'Roof',
        storyHeight: 12,
        fxPsf: 10,
        weightPsf: 50,
        outline: rect(100, 50),
        shearLines: [
          shearLine('roof', '1', 'Y', 0, [[0, 50]]),
          shearLine('roof', '2', 'Y', 90, [[0, 50]]),
          shearLine('roof', 'A', 'X', 0, [[0, 100]]),
          shearLine('roof', 'B', 'X', 50, [[0, 100]]),
        ],
      }),
    ],
    loads: loads({ sds: 0.6 }),
  }
}

export const allFixtures = {
  T1: t1,
  T1b: t1b,
  T1w: t1w,
  T2: t2,
  T3: t3,
  T4: t4,
  T5: t5,
  T6: t6,
  T6b: t6b,
  T7: t7,
} satisfies Record<string, () => Project>
