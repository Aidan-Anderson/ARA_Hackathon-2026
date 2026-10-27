// Load flowing down the building (docs/spec.md §5.8, §5.10): story shear down Shear Lines that
// continue, and Transfer Forces where a line stops.

import type { Axis, Level, ShearLine } from '../model/project'
import type { LevelResult, TransferResult } from '../model/results'
import { clippedElements, collectorForce } from './collectors'
import { EPS } from './math'
import { cutAt, totalLength } from './sections'

/** A Shear Line continues into the Level below if a line there sits within this distance. */
const CONTINUES_WITHIN_FT = 0.5

/** A stopped line's story shear, landing on the Diaphragm of the Level below. */
export interface Transfer {
  fromLevelId: string
  line: ShearLine
  /** kips */
  force: number
}

/** What the Level above hands to this one in one Load Case. */
export interface FromAbove {
  /** Story shear arriving on each of this Level's lines, by line id. */
  shear: Map<string, number>
  transfers: Transfer[]
}

export const NOTHING_FROM_ABOVE: FromAbove = { shear: new Map(), transfers: [] }

/** The line on the Level below that `line` continues into, if any (the closest within 0.5 ft). */
export function continuation(line: ShearLine, below: Level): ShearLine | undefined {
  let best: ShearLine | undefined
  for (const candidate of below.shearLines) {
    const gap = Math.abs(candidate.position - line.position)
    if (candidate.direction === line.direction && gap <= CONTINUES_WITHIN_FT + EPS) {
      if (!best || gap < Math.abs(best.position - line.position)) best = candidate
    }
  }
  return best
}

/**
 * Split the upper Level's story shears: lines that continue pass theirs straight down; lines that
 * stop become Transfer Forces. Transfers that miss the Diaphragm below are dropped here and
 * reported by validate (transfer-outside).
 */
export function fromAbove(upper: Level, upperResult: LevelResult, below: Level, direction: Axis): FromAbove {
  const shear = new Map<string, number>()
  const transfers: Transfer[] = []
  for (const lineResult of upperResult.lines) {
    const line = upper.shearLines.find((l) => l.id === lineResult.lineId)
    if (!line) continue
    const into = continuation(line, below)
    if (into) shear.set(into.id, (shear.get(into.id) ?? 0) + lineResult.storyShear)
    else if (cutAt(below, direction, line.position)) {
      transfers.push({ fromLevelId: upper.id, line, force: lineResult.storyShear })
    }
  }
  return { shear, transfers }
}

/**
 * The transfer Collector in the Diaphragm below, along the stopped line: shear comes in from the
 * stopped line's Lateral Elements and spreads uniformly into the Diaphragm over its net length.
 */
export function transferResult(level: Level, direction: Axis, transfer: Transfer): TransferResult {
  const base = {
    fromLevelId: transfer.fromLevelId,
    fromLineId: transfer.line.id,
    position: transfer.line.position,
    force: transfer.force,
  }
  const cut = cutAt(level, direction, transfer.line.position)
  const netLength = cut ? totalLength(cut.net) : 0
  const elements = cut ? clippedElements(transfer.line, cut.section).filter((e) => e.length > EPS) : []
  const elementLength = elements.reduce((sum, e) => sum + e.length, 0)
  if (!cut || netLength <= EPS || elementLength <= EPS) {
    return { ...base, collectorPlf: 0, collector: { force: { s: [], v: [] }, maxForce: 0 } }
  }
  return {
    ...base,
    collectorPlf: (transfer.force / netLength) * 1000,
    collector: collectorForce(
      cut.section[0],
      cut.section[1],
      elements.map((e) => ({ from: e.start, to: e.end, v: transfer.force / elementLength })),
      cut.net.map(([from, to]) => ({ from, to, v: transfer.force / netLength })),
    ),
  }
}
