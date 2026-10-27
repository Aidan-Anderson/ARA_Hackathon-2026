// Track A: results tables for the current Level and Load Case, or the Envelope (spec §6.5).
// Tickets A1.1, A2.x, A3.x, A4.1. Placeholder from P0.2.

import type { AppViewProps } from '../../model/ui'

export function ResultsPanel({ results, levelId, caseId }: AppViewProps) {
  const levelResult =
    caseId === 'ENV' ? undefined : results.cases[caseId].levels.find((level) => level.levelId === levelId)
  return (
    <div className="placeholder">
      <h2>Results</h2>
      <p>
        {caseId === 'ENV'
          ? `Envelope: ${results.envelope.length} entries`
          : `${caseId}: F_x ${levelResult?.fx ?? 0} k, ${levelResult?.lines.length ?? 0} Shear Lines analyzed`}
      </p>
    </div>
  )
}
