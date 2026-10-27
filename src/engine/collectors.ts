// Along each Shear Line: Lateral Element Demands and the Collector force diagram
// (docs/spec.md §5.8–5.9). Line axis t: y for Y-lines, x for X-lines.

import type { LateralElement, ShearLine } from '../model/project'
import type { Diagram, LineResult } from '../model/results'
import { EPS, maxAbs, uniqueSorted } from './math'
import { totalLength, type Cut } from './sections'

/** Unit shear v (kips/ft) over [from, to] on the line axis. */
export interface ShearSegment {
  from: number
  to: number
  v: number
}

export interface CollectorResult {
  force: Diagram
  maxForce: number
}

const NO_COLLECTOR: CollectorResult = { force: { s: [], v: [] }, maxForce: 0 }

/**
 * F(t) = ∫ (v_in − v_out) dt from lo, sampled at every segment end and at most maxStep apart.
 * Works for any in/out pair: a Shear Line's Collector, or a transfer Collector (A4.1).
 */
export function collectorForce(
  lo: number,
  hi: number,
  incoming: ShearSegment[],
  outgoing: ShearSegment[],
  maxStep = 1,
): CollectorResult {
  const segments = [...incoming, ...outgoing]
  const breaks = uniqueSorted([lo, hi, ...segments.flatMap((seg) => [seg.from, seg.to]).filter((t) => t > lo && t < hi)])
  const rate = (t: number) =>
    incoming.reduce((sum, seg) => sum + (seg.from <= t && t < seg.to ? seg.v : 0), 0) -
    outgoing.reduce((sum, seg) => sum + (seg.from <= t && t < seg.to ? seg.v : 0), 0)

  const s = [lo]
  const v = [0]
  let force = 0
  for (let i = 0; i + 1 < breaks.length; i++) {
    const a = breaks[i]
    const b = breaks[i + 1]
    const slope = rate((a + b) / 2) // constant between breakpoints, so F is linear there
    const count = Math.max(1, Math.ceil((b - a) / maxStep - EPS))
    for (let k = 1; k <= count; k++) {
      const t = a + (k * (b - a)) / count
      s.push(t)
      v.push(force + slope * (t - a))
    }
    force += slope * (b - a)
  }
  return { force: { s, v }, maxForce: maxAbs(v) }
}

/** The line's Lateral Elements clipped to the Diaphragm cross-section [lo, hi]. */
export function clippedElements(line: ShearLine, [lo, hi]: [number, number]): (LateralElement & { length: number })[] {
  return line.lateralElements.map((element) => {
    const start = Math.max(element.start, lo)
    const end = Math.min(element.end, hi)
    return { ...element, start, end, length: Math.max(0, end - start) }
  })
}

/** The line's story shear split among its Lateral Elements by length (equal unit shear). */
export function elementDemands(line: ShearLine, section: [number, number], storyShear: number): LineResult['elements'] {
  const elements = clippedElements(line, section)
  const total = elements.reduce((sum, element) => sum + element.length, 0)
  return elements.map((element) => ({
    elementId: element.id,
    force: total > EPS ? (storyShear * element.length) / total : 0,
    unitShear: total > EPS && element.length > EPS ? (storyShear / total) * 1000 : 0,
  }))
}

/**
 * The Collector along a Shear Line at F_px level: Diaphragm shear comes in uniformly along the net
 * length (none across Openings) and goes out to the Lateral Elements by length.
 */
export function lineCollector(line: ShearLine, cut: Cut, reactionFpx: number): CollectorResult {
  const elements = clippedElements(line, cut.section).filter((element) => element.length > EPS)
  const elementLength = elements.reduce((sum, element) => sum + element.length, 0)
  const netLength = totalLength(cut.net)
  if (elementLength <= EPS || netLength <= EPS) return NO_COLLECTOR

  return collectorForce(
    cut.section[0],
    cut.section[1],
    cut.net.map(([from, to]) => ({ from, to, v: reactionFpx / netLength })),
    elements.map((element) => ({ from: element.start, to: element.end, v: reactionFpx / elementLength })),
  )
}
