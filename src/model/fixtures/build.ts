// Small builders that keep the fixtures readable. Ids are deterministic so tests can refer to them.

import type { Axis, Level, Loads, Opening, Point, ShearLine } from '../project'

/** Counter-clockwise rectangle with its bottom-left corner at the origin. */
export function rect(width: number, depth: number): Point[] {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: depth },
    { x: 0, y: depth },
  ]
}

/** Shear Line with id `${levelPrefix}-${name}`; element ids `${lineId}-e1`, `-e2`, … */
export function shearLine(
  levelPrefix: string,
  name: string,
  direction: Axis,
  position: number,
  elements: [start: number, end: number][],
): ShearLine {
  const id = `${levelPrefix}-${name}`
  return {
    id,
    name,
    direction,
    position,
    lateralElements: elements.map(([start, end], i) => ({ id: `${id}-e${i + 1}`, kind: 'shearWall', start, end })),
  }
}

export function level(spec: {
  id: string
  name: string
  storyHeight: number
  fxPsf: number
  weightPsf: number
  outline: Point[]
  shearLines: ShearLine[]
  openings?: Opening[]
}): Level {
  return {
    id: spec.id,
    name: spec.name,
    storyHeight: spec.storyHeight,
    outline: spec.outline,
    shearLines: spec.shearLines,
    openings: spec.openings ?? [],
    seismic: { fxPsf: spec.fxPsf, weightPsf: spec.weightPsf },
  }
}

/** Fresh Loads each call, so fixtures never share nested objects. */
export function loads(overrides: Partial<Omit<Loads, 'windPlf'>> & { windPlf?: Partial<Loads['windPlf']> } = {}): Loads {
  const { windPlf, ...rest } = overrides
  return {
    sds: 1.3,
    ie: 1.0,
    rho: 1.0,
    omega0: 3.0,
    ...rest,
    windPlf: { X: 0, Y: 0, ...windPlf },
  }
}
