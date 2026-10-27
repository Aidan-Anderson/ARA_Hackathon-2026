// Track A: the selected element in every Load Case, with ρ or Ω₀ applied (spec §5.12, §6.5).
// Ticket A4.2. Placeholder from P0.2.

import type { AppViewProps } from '../../model/ui'

export function DetailPanel({ selection }: AppViewProps) {
  return (
    <div className="placeholder">
      <h2>Detail</h2>
      <p>{selection ? `Selected ${selection.kind} on ${selection.levelId}` : 'Nothing selected'}</p>
    </div>
  )
}
