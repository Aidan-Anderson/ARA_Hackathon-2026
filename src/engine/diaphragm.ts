// Diaphragm Spans between adjacent Shear Lines (docs/spec.md §5.5–5.6, ADR 0001).
// Lines passed in must be sorted by position and share the load direction.

import type { ShearLine } from '../model/project'
import type { SpanResult } from '../model/results'
import { maxAbs, simpleBeam, type BeamLoads } from './beam'
import { depthAt, type DepthPiece } from './sections'

export interface DiaphragmDepth {
  /** Chords use gross depth. */
  gross: DepthPiece[]
  /** Unit shear uses net depth (Openings removed, A2.2). */
  net: DepthPiece[]
}

export interface DiaphragmSpans {
  /** Diaphragm Reaction on each line, in the order given. */
  reactions: number[]
  spans: SpanResult[]
  /** plf on each line's lower-s side and higher-s side; 0 where there is no span. */
  unitShearLeft: number[]
  unitShearRight: number[]
}

/** Uniform load q (ksf) over the Diaphragm: w(s) = q · depth(s). */
export function areaLoad(depth: DepthPiece[], q: number): BeamLoads {
  return { uniform: depth.map((piece) => ({ from: piece.from, to: piece.to, w: q * piece.depth })), points: [] }
}

/** Reactions only: the F_x run, where the diagrams aren't needed. */
export function diaphragmReactions(lines: ShearLine[], loads: BeamLoads): number[] {
  const reactions = lines.map(() => 0)
  forEachSpan(lines, (j, start, end) => {
    const beam = simpleBeam(start, end, loads)
    reactions[j] += beam.rStart
    reactions[j + 1] += beam.rEnd
  })
  return reactions
}

/** Reactions, span diagrams, and unit shear at each line: the F_px run. */
export function diaphragmSpans(lines: ShearLine[], loads: BeamLoads, depth: DiaphragmDepth): DiaphragmSpans {
  const result: DiaphragmSpans = {
    reactions: lines.map(() => 0),
    spans: [],
    unitShearLeft: lines.map(() => 0),
    unitShearRight: lines.map(() => 0),
  }
  const depthBreaks = [...depth.gross, ...depth.net].flatMap((piece) => [piece.from, piece.to])

  forEachSpan(lines, (j, start, end) => {
    const beam = simpleBeam(start, end, loads)
    result.reactions[j] += beam.rStart
    result.reactions[j + 1] += beam.rEnd
    result.unitShearRight[j] = plf(beam.shearAt(start, 'right'), depthAt(depth.net, start, 'right'))
    result.unitShearLeft[j + 1] = plf(beam.shearAt(end, 'left'), depthAt(depth.net, end, 'left'))

    const { s, shear, moment } = beam.stations(1, depthBreaks)
    const sides = stationSides(s, end)
    const unitShear = shear.map((v, i) => plf(v, depthAt(depth.net, s[i], sides[i])))
    const chord = moment.map((m, i) => {
      const d = depthAt(depth.gross, s[i], sides[i])
      return d > 0 ? Math.abs(m) / d : 0
    })

    result.spans.push({
      kind: 'span',
      fromLineId: lines[j].id,
      toLineId: lines[j + 1].id,
      start,
      end,
      shear: { s, v: shear },
      moment: { s, v: moment },
      unitShear: { s, v: unitShear },
      chord: { s, v: chord },
      maxShear: maxAbs(shear),
      maxUnitShear: maxAbs(unitShear),
      maxMoment: maxAbs(moment),
      maxChord: maxAbs(chord),
    })
  })
  return result
}

function forEachSpan(lines: ShearLine[], visit: (j: number, start: number, end: number) => void): void {
  for (let j = 0; j + 1 < lines.length; j++) {
    const start = lines[j].position
    const end = lines[j + 1].position
    if (end - start > 1e-9) visit(j, start, end) // two lines at one position have no span between them
  }
}

/** |V| / depth in plf. */
function plf(shear: number, depth: number): number {
  return depth > 0 ? (Math.abs(shear) / depth) * 1000 : 0
}

/**
 * Which side's depth applies at each station. Stations repeat at breakpoints (left value, then right
 * value); the span's last station looks left, every other station looks right.
 */
function stationSides(s: number[], end: number): ('left' | 'right')[] {
  return s.map((value, i) => (s[i + 1] === value || value >= end ? 'left' : 'right'))
}
