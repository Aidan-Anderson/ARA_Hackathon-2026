// Results of analyze() (docs/spec.md §4.4). Shared by both tracks: announce changes in the commit message.
// All values are strength level, without ρ or Ω₀. ASD = value × asdFactor.

import type { Axis, Point } from './project'

export type LoadCaseId = 'SX' | 'SY' | 'WX' | 'WY'

export const LOAD_CASES: readonly { id: LoadCaseId; label: string; direction: Axis; asdFactor: number }[] = [
  { id: 'SX', label: 'Seismic X', direction: 'X', asdFactor: 0.7 },
  { id: 'SY', label: 'Seismic Y', direction: 'Y', asdFactor: 0.7 },
  { id: 'WX', label: 'Wind X', direction: 'X', asdFactor: 0.6 },
  { id: 'WY', label: 'Wind Y', direction: 'Y', asdFactor: 0.6 },
]

export interface Results {
  cases: Record<LoadCaseId, CaseResult>
  envelope: EnvelopeEntry[]
  warnings: Warning[]
}

export interface CaseResult {
  caseId: LoadCaseId
  /** Load direction. */
  direction: Axis
  /** 0.7 seismic, 0.6 wind */
  asdFactor: number
  /** Same order as project.levels. */
  levels: LevelResult[]
}

export interface LevelResult {
  levelId: string
  /** sf, outline minus Openings */
  netArea: number
  /** kips: Story Force (seismic) or total wind on the Level */
  fx: number
  /** kips: seismic weight (0 for wind) */
  weight: number
  /** Seismic only. */
  fpx?: FpxResult
  /** Diaphragm Spans and Overhangs, ordered along the span axis. */
  spans: SpanResult[]
  /** Shear Lines in the load direction only. */
  lines: LineResult[]
  corners: CornerResult[]
  /** Transfer Forces applied to this Level's Diaphragm. */
  transfersIn: TransferResult[]
}

export interface FpxResult {
  /** (ΣF_i / Σw_i) · w_px */
  raw: number
  /** 0.2 · S_DS · I_e · w_px */
  min: number
  /** 0.4 · S_DS · I_e · w_px */
  max: number
  /** raw clamped to [min, max] */
  fpx: number
  /** max(fx, fpx): what the Diaphragm, Chords, and Collectors use */
  design: number
  governs: 'equation' | 'min' | 'max' | 'fx'
}

/** Values v at stations s (ft) along a span axis or a line axis. */
export interface Diagram {
  s: number[]
  v: number[]
}

export interface SpanResult {
  kind: 'span' | 'overhang'
  /** null at the free end of an Overhang */
  fromLineId: string | null
  toLineId: string | null
  /** ft along the span axis */
  start: number
  end: number
  /** kips (F_px design level) */
  shear: Diagram
  /** kip-ft (F_px design level) */
  moment: Diagram
  /** plf = |V| / net depth */
  unitShear: Diagram
  /** kips = |M| / gross depth */
  chord: Diagram
  maxShear: number
  maxUnitShear: number
  maxMoment: number
  maxChord: number
}

export interface LineResult {
  lineId: string
  /** ft, Diaphragm cross-section at the line */
  length: number
  /** kips, Diaphragm Reaction at F_x level (includes Transfer Forces into this Level) */
  reactionFx: number
  /** kips, at F_px design level */
  reactionFpx: number
  /** kips, carried by this line's Lateral Elements (Story below this Level) */
  storyShear: number
  /** plf, Diaphragm unit shear on the lower-s side (F_px level) */
  unitShearLeft: number
  /** plf, on the higher-s side */
  unitShearRight: number
  /** force in kips, unitShear in plf */
  elements: { elementId: string; force: number; unitShear: number }[]
  /** kips along the line axis (F_px level) */
  collector: { force: Diagram; maxForce: number }
  /** false → its story shear becomes a Transfer Force */
  continuesBelow: boolean
}

export interface CornerResult {
  /** ft along the span axis */
  s: number
  /** The inside corner vertex. */
  point: Point
  /** kips, M / narrower gross depth (F_px level) */
  force: number
}

export interface TransferResult {
  /** Level of the Shear Line that stops. */
  fromLevelId: string
  fromLineId: string
  /** ft along the span axis */
  position: number
  /** kips (the stopped line's story shear) */
  force: number
  /** force / net depth at that position × 1000 */
  collectorPlf: number
  collector: { force: Diagram; maxForce: number }
}

export interface EnvelopeEntry {
  levelId: string
  kind: 'lateralElement' | 'line' | 'collector' | 'transferCollector' | 'span'
  /** element id, line id, line id, "fromLevelId:fromLineId", or "lineIdFrom→lineIdTo" ("free" at an Overhang's free end) */
  refId: string
  quantity: 'force' | 'storyShear' | 'unitShear' | 'chord' | 'collectorForce'
  strength: { value: number; caseId: LoadCaseId }
  asd: { value: number; caseId: LoadCaseId }
}

export interface Warning {
  severity: 'error' | 'warning'
  code:
    | 'outline-invalid' // not orthogonal, self-intersecting, or a cut passes through two pieces
    | 'too-few-lines' // fewer than 2 Shear Lines in a direction on a Level
    | 'line-without-elements' // a Shear Line with a nonzero reaction but no Lateral Elements
    | 'element-off-line' // part of a Lateral Element is outside the line's length (it is clipped)
    | 'opening-chords' // chord forces around Openings are not calculated
    | 'overhang-long' // Overhang longer than 6 ft
    | 'transfer-outside' // a stopped Shear Line lands outside the Diaphragm below
    | 'reentrant-irregularity' // §12.3.3.4 +25% applied to Collectors (A5 only)
  levelId?: string
  refId?: string
  message: string
}
