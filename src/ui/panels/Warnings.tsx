// Track A: warnings bar for the current Level (spec §6.1).
// Ticket A3.2. Placeholder from P0.2.

import type { AppViewProps } from '../../model/ui'

export function Warnings({ results, levelId }: AppViewProps) {
  const count = results.warnings.filter((warning) => !warning.levelId || warning.levelId === levelId).length
  return <span className="placeholder">Warnings: {count}</span>
}
