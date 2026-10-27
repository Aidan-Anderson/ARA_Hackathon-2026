// Simple-beam statics for one Diaphragm Span (docs/spec.md §5.5, ADR 0001).
// s is the absolute coordinate along the span axis (ft). Loads act in the load direction;
// reactions are positive against the load. Units: ft, kips, kip-ft.

/** w kips/ft over [from, to]. */
export interface UniformLoad {
  from: number
  to: number
  w: number
}

/** p kips at s = at. */
export interface PointLoad {
  at: number
  p: number
}

export interface BeamLoads {
  uniform: UniformLoad[]
  points: PointLoad[]
}

export interface Stations {
  s: number[]
  shear: number[]
  moment: number[]
}

export interface SimpleBeam {
  start: number
  end: number
  rStart: number
  rEnd: number
  /** Shear (kips) just right of s, or just left with side 'left'. Differs only at point loads. */
  shearAt(s: number, side?: 'left' | 'right'): number
  /** Moment (kip-ft) at s. */
  momentAt(s: number): number
  /**
   * Diagram stations at most maxStep apart, exact at every breakpoint and every zero-shear point.
   * Interior breakpoints appear twice: the left value, then the right value.
   */
  stations(maxStep?: number, extraBreaks?: number[]): Stations
}

const EPS = 1e-9

/** A simply supported beam over [start, end]. Loads outside the span are ignored. */
export function simpleBeam(start: number, end: number, loads: BeamLoads): SimpleBeam {
  const uniform = loads.uniform
    .map((load) => ({ from: Math.max(load.from, start), to: Math.min(load.to, end), w: load.w }))
    .filter((load) => load.to - load.from > EPS)
  const points = loads.points.filter((load) => load.at >= start - EPS && load.at <= end + EPS)

  let total = 0
  let momentAboutStart = 0
  for (const load of uniform) {
    const force = load.w * (load.to - load.from)
    total += force
    momentAboutStart += force * ((load.from + load.to) / 2 - start)
  }
  for (const load of points) {
    total += load.p
    momentAboutStart += load.p * (load.at - start)
  }
  const rEnd = momentAboutStart / (end - start)
  const rStart = total - rEnd

  function shearAt(s: number, side: 'left' | 'right' = 'right'): number {
    let shear = rStart
    for (const load of uniform) shear -= load.w * loadedLength(load, s)
    for (const load of points) if (side === 'right' ? load.at <= s + EPS : load.at < s - EPS) shear -= load.p
    return shear
  }

  function momentAt(s: number): number {
    let moment = rStart * (s - start)
    for (const load of uniform) {
      const length = loadedLength(load, s)
      moment -= load.w * length * (s - (load.from + length / 2))
    }
    for (const load of points) if (load.at < s) moment -= load.p * (s - load.at)
    return moment
  }

  function stations(maxStep = 1, extraBreaks: number[] = []): Stations {
    const breaks = uniqueSorted([
      start,
      end,
      ...uniform.flatMap((load) => [load.from, load.to]),
      ...points.map((load) => load.at),
      ...extraBreaks.filter((s) => s > start && s < end),
    ])
    const out: Stations = { s: [], shear: [], moment: [] }
    for (let i = 0; i + 1 < breaks.length; i++) {
      const a = breaks[i]
      const b = breaks[i + 1]
      const count = Math.max(1, Math.ceil((b - a) / maxStep - EPS))
      const inner = Array.from({ length: count - 1 }, (_, k) => a + ((k + 1) * (b - a)) / count)
      // Shear is linear between breakpoints, so a sign change means one exact zero-shear point.
      const va = shearAt(a, 'right')
      const vb = shearAt(b, 'left')
      if (va * vb < 0) inner.push(a + (va * (b - a)) / (va - vb))
      // Each piece runs a (right value) … b (left value), so interior breakpoints come out twice.
      const pieceStations = [a, ...uniqueSorted(inner).filter((s) => s > a + EPS && s < b - EPS), b]
      pieceStations.forEach((s, k) => {
        out.s.push(s)
        out.shear.push(shearAt(s, k === pieceStations.length - 1 ? 'left' : 'right'))
        out.moment.push(momentAt(s))
      })
    }
    return out
  }

  return { start, end, rStart, rEnd, shearAt, momentAt, stations }
}

/** Length of a uniform load that lies left of s. */
function loadedLength(load: UniformLoad, s: number): number {
  return Math.max(0, Math.min(load.to, s) - load.from)
}

function uniqueSorted(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.filter((value, i) => i === 0 || value - sorted[i - 1] > EPS)
}

export function maxAbs(values: number[]): number {
  return values.reduce((max, value) => Math.max(max, Math.abs(value)), 0)
}
