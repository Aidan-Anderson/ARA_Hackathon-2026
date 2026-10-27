// Track A: ASCE 7-22 ELF calc and USGS site lookup, writing F_x into each Level (spec §5.14).
// Ticket A5.1. Placeholder from P0.2.

import type { AppViewProps } from '../../model/ui'

export function SeismicCodePanel({ project }: AppViewProps) {
  return (
    <div className="placeholder">
      <h2>Code calc</h2>
      <p>{project.loads.seismicCode ? 'Code inputs entered' : 'No code inputs yet'}</p>
    </div>
  )
}
