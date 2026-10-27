// Diaphragm Spans and Overhangs between Shear Lines (docs/spec.md §5.5–5.7, ADR 0001).

import type { Axis, Level, ShearLine } from '../model/project'
import type { CornerResult, SpanResult } from '../model/results'
import { cantilever, simpleBeam, type Beam, type BeamLoads } from './beam'
import { maxAbs } from './math'
import { depthAt, type DepthPiece, type ReentrantVertex, type Sections } from './sections'

/** Shorter than this, an Overhang is just drawing noise. */
const OVERHANG_MIN = 0.01
/** Re-entrant Corners this close to a Shear Line sit at a hinge (M = 0) and are skipped. */
const CORNER_CLEARANCE = 0.01

export interface DiaphragmSpans {
  /** Diaphragm Reaction on each line, in the order given. */
  reactions: number[]
  /** Spans and Overhangs, ordered along the span axis. */
  spans: SpanResult[]
  /** plf on each line's lower-s side and higher-s side; 0 where there is no Diaphragm. */
  unitShearLeft: number[]
  unitShearRight: number[]
  corners: CornerResult[]
}

/** The Level's Shear Lines in one direction, sorted by position. */
export function shearLinesIn(level: Level, direction: Axis): ShearLine[] {
  return level.shearLines.filter((line) => line.direction === direction).sort((a, b) => a.position - b.position)
}

/** Uniform load q (ksf) over the net Diaphragm: w(s) = q · net depth(s). */
export function areaLoad(net: DepthPiece[], q: number): BeamLoads {
  return { uniform: net.map((piece) => ({ from: piece.from, to: piece.to, w: q * piece.depth })), points: [] }
}

/** Overhang lengths beyond the first and last line (0 if none). */
export function overhangs(lines: ShearLine[], extent: [number, number]): { before: number; after: number } {
  const before = lines[0].position - extent[0]
  const after = extent[1] - lines[lines.length - 1].position
  return { before: before > OVERHANG_MIN ? before : 0, after: after > OVERHANG_MIN ? after : 0 }
}

/** Reactions only: the F_x run, where the diagrams aren't needed. */
export function diaphragmReactions(lines: ShearLine[], loads: BeamLoads, extent: [number, number]): number[] {
  const reactions = lines.map(() => 0)
  for (const { from, to, beam } of spanBeams(lines, loads, extent)) {
    if (from !== null) reactions[from] += beam.rStart
    if (to !== null) reactions[to] += beam.rEnd
  }
  return reactions
}

/** Reactions, span and Overhang diagrams, unit shear at each line, and Re-entrant Corners: the F_px run. */
export function diaphragmSpans(
  lines: ShearLine[],
  loads: BeamLoads,
  sections: Pick<Sections, 'gross' | 'net'>,
  extent: [number, number],
  reentrant: ReentrantVertex[],
): DiaphragmSpans {
  const result: DiaphragmSpans = {
    reactions: lines.map(() => 0),
    spans: [],
    unitShearLeft: lines.map(() => 0),
    unitShearRight: lines.map(() => 0),
    corners: [],
  }
  const { gross, net } = sections
  const depthBreaks = [...gross, ...net].flatMap((piece) => [piece.from, piece.to])

  for (const { kind, from, to, beam } of spanBeams(lines, loads, extent)) {
    const { start, end } = beam
    if (from !== null) {
      result.reactions[from] += beam.rStart
      result.unitShearRight[from] = plf(beam.shearAt(start, 'right'), depthAt(net, start, 'right'))
    }
    if (to !== null) {
      result.reactions[to] += beam.rEnd
      result.unitShearLeft[to] = plf(beam.shearAt(end, 'left'), depthAt(net, end, 'left'))
    }

    const { s, shear, moment } = beam.stations(1, depthBreaks)
    const sides = stationSides(s, end)
    const unitShear = shear.map((v, i) => plf(v, depthAt(net, s[i], sides[i])))
    const chord = moment.map((m, i) => {
      const d = depthAt(gross, s[i], sides[i])
      return d > 0 ? Math.abs(m) / d : 0
    })

    result.spans.push({
      kind,
      fromLineId: from === null ? null : lines[from].id,
      toLineId: to === null ? null : lines[to].id,
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

    for (const corner of reentrant) {
      if (corner.s > start + CORNER_CLEARANCE && corner.s < end - CORNER_CLEARANCE) {
        result.corners.push({ s: corner.s, point: corner.point, force: Math.abs(beam.momentAt(corner.s)) / corner.narrowDepth })
      }
    }
  }
  return result
}

interface SpanBeam {
  kind: SpanResult['kind']
  /** Index of the line at the span's start, or null at an Overhang's free end. */
  from: number | null
  /** Index of the line at the span's end, or null at an Overhang's free end. */
  to: number | null
  beam: Beam
}

/** Simple spans between adjacent lines, plus cantilever Overhangs beyond the first and last line. */
function spanBeams(lines: ShearLine[], loads: BeamLoads, extent: [number, number]): SpanBeam[] {
  const beams: SpanBeam[] = []
  const first = lines[0].position
  const last = lines[lines.length - 1].position
  const { before, after } = overhangs(lines, extent)

  if (before > 0) beams.push({ kind: 'overhang', from: null, to: 0, beam: cantilever(extent[0], first, loads, 'end') })
  for (let j = 0; j + 1 < lines.length; j++) {
    const start = lines[j].position
    const end = lines[j + 1].position
    if (end - start > 1e-9) beams.push({ kind: 'span', from: j, to: j + 1, beam: simpleBeam(start, end, loads) })
  }
  if (after > 0) {
    beams.push({ kind: 'overhang', from: lines.length - 1, to: null, beam: cantilever(last, extent[1], loads, 'start') })
  }
  return beams
}

/** |V| / depth in plf. */
function plf(shear: number, depth: number): number {
  return depth > 0 ? (Math.abs(shear) / depth) * 1000 : 0
}

/**
 * Which side's depth applies at each station. Stations repeat at breakpoints (left value, then right
 * value); the last station looks left, every other station looks right.
 */
function stationSides(s: number[], end: number): ('left' | 'right')[] {
  return s.map((value, i) => (s[i + 1] === value || value >= end ? 'left' : 'right'))
}
