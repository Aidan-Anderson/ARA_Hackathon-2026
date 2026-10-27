import { describe, expect, it } from 'vitest'
import { analyze } from '../../engine/analyze'
import { t1, t3 } from '../../model/fixtures'
import { addShearLine, setOutline, updateLevel } from './edit'
import { checkOutline } from '../../model/outline'
import type { Point } from '../../model/project'
import { gridlines } from './grid'
import { closeOutline, drawnLineName, nextVertex, snapLinePosition, snapPoint, type SnapContext } from './snap'

const draw = (vertices: Point[] = []): SnapContext => ({ mode: 'draw', vertices, gridlines: [], tolerance: 1.5 })
const pts = (...coords: [number, number][]): Point[] => coords.map(([x, y]) => ({ x, y }))

describe('snapping (B2.1)', () => {
  it('rounds to 1 ft in draw mode, and prefers a nearby corner', () => {
    expect(snapPoint({ x: 12.4, y: 7.6 }, draw())).toEqual({ x: 12, y: 8 })
    expect(snapPoint({ x: 29.2, y: 24.6 }, draw(pts([30, 25])))).toEqual({ x: 30, y: 25 })
  })

  it('snaps to Gridlines in grid mode', () => {
    const ctx: SnapContext = { mode: 'grid', vertices: [], gridlines: gridlines(t1().grid), tolerance: 1.5 }
    expect(snapPoint({ x: 39.1, y: 48.9 }, ctx)).toEqual({ x: 40, y: 50 })
    expect(snapPoint({ x: 25.4, y: 20.2 }, ctx)).toEqual({ x: 25, y: 20 }) // away from Gridlines: 1 ft
  })

  it('keeps each new edge horizontal or vertical, whichever is closer to the mouse', () => {
    expect(nextVertex({ x: 0, y: 0 }, { x: 59.7, y: 3 }, draw())).toEqual({ x: 60, y: 0 })
    expect(nextVertex({ x: 60, y: 0 }, { x: 58, y: 25.3 }, draw())).toEqual({ x: 60, y: 25 })
  })

  it('places a drawn Shear Line and names it', () => {
    expect(snapLinePosition({ x: 39.6, y: 10 }, 'Y', draw())).toBe(40)
    expect(snapLinePosition({ x: 39.6, y: 12.4 }, 'X', draw())).toBe(12)
    expect(drawnLineName('Y', 40)).toBe('Y@40')
    expect(drawnLineName('X', 12.5)).toBe('X@12.5')
  })
})

describe('closeOutline (B2.1)', () => {
  it('turns the T3 L-shape drawn clockwise into a valid counter-clockwise outline', () => {
    const clockwise = pts([0, 0], [0, 50], [30, 50], [30, 25], [60, 25], [60, 0])
    const outline = closeOutline(clockwise)
    expect(checkOutline(outline)).toEqual({ ok: true })
    expect(new Set(outline.map((p) => `${p.x},${p.y}`))).toEqual(new Set(t3().levels[0].outline.map((p) => `${p.x},${p.y}`)))
  })

  it('adds the missing corner when the last edge doesn’t line up with the start', () => {
    // Drawn 0,0 → 100,0 → 100,50, then closed: the corner (0, 50) is added.
    expect(closeOutline(pts([0, 0], [100, 0], [100, 50]))).toEqual(pts([0, 0], [100, 0], [100, 50], [0, 50]))
  })

  it('drops repeated corners and corners in a straight run', () => {
    const messy = pts([0, 0], [50, 0], [50, 0], [100, 0], [100, 50], [0, 50], [0, 0])
    expect(closeOutline(messy)).toEqual(pts([0, 0], [100, 0], [100, 50], [0, 50]))
  })
})

describe('drawing T3 end to end (B2.1 acceptance)', () => {
  it('drawn L-shape + Y-lines at x = 0 and 60 gives SY reactions 13.125 / 9.375', () => {
    // Start from T1 with its Shear Lines removed, then do what the tools do.
    let project = updateLevel(t1(), 'roof', (level) => ({ ...level, shearLines: [] }))
    project.levels[0].seismic = { fxPsf: 10, weightPsf: 50 }
    project.loads.sds = 0.6
    const clicks = pts([0, 0], [0, 50], [30, 50], [30, 25], [60, 25], [60, 0]) // clockwise, as a user might
    project = setOutline(project, 'roof', closeOutline(clicks.map((c, i) => nextVertex(i === 0 ? null : clicks[i - 1], c, draw()))))
    project = addShearLine(project, 'roof', { name: drawnLineName('Y', 0), direction: 'Y', position: 0 })
    project = addShearLine(project, 'roof', { name: drawnLineName('Y', 60), direction: 'Y', position: 60 })

    const lines = analyze(project).cases.SY.levels[0].lines
    expect(lines.map((line) => line.reactionFx)).toEqual([expect.closeTo(13.125, 6), expect.closeTo(9.375, 6)])
    expect(lines.map((line) => line.length)).toEqual([50, 25]) // each line's default wall spans the L
  })
})
