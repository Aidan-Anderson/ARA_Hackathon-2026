// The Envelope: the governing Demand for each element across all Load Cases (docs/spec.md §5.11).
// Strength and ASD are enveloped separately, because 0.7 E and 0.6 W can rank differently.

import { LOAD_CASES, type CaseResult, type EnvelopeEntry, type LoadCaseId } from '../model/results'

export function envelope(cases: Record<LoadCaseId, CaseResult>): EnvelopeEntry[] {
  const entries = new Map<string, EnvelopeEntry>()

  for (const { id: caseId } of LOAD_CASES) {
    const { asdFactor, levels } = cases[caseId]
    for (const level of levels) {
      const consider = (
        kind: EnvelopeEntry['kind'],
        refId: string,
        quantity: EnvelopeEntry['quantity'],
        value: number,
      ) => {
        const strength = Math.abs(value)
        const asd = strength * asdFactor
        const key = `${level.levelId}|${kind}|${refId}|${quantity}`
        const entry = entries.get(key)
        if (!entry) {
          const first = { levelId: level.levelId, kind, refId, quantity }
          entries.set(key, { ...first, strength: { value: strength, caseId }, asd: { value: asd, caseId } })
          return
        }
        if (strength > entry.strength.value) entry.strength = { value: strength, caseId }
        if (asd > entry.asd.value) entry.asd = { value: asd, caseId }
      }

      for (const line of level.lines) {
        for (const element of line.elements) consider('lateralElement', element.elementId, 'force', element.force)
        consider('line', line.lineId, 'storyShear', line.storyShear)
        consider('collector', line.lineId, 'collectorForce', line.collector.maxForce)
      }
      for (const span of level.spans) {
        // 'free' marks an Overhang's free end.
        const refId = `${span.fromLineId ?? 'free'}→${span.toLineId ?? 'free'}`
        consider('span', refId, 'unitShear', span.maxUnitShear)
        consider('span', refId, 'chord', span.maxChord)
      }
      for (const transfer of level.transfersIn) {
        consider('transferCollector', `${transfer.fromLevelId}:${transfer.fromLineId}`, 'collectorForce', transfer.collector.maxForce)
      }
    }
  }
  return [...entries.values()]
}
