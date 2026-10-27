// Track B: building and Level inputs, plus the Grid editor (spec §6.4).
// Ticket B1.1. Placeholder from P0.2.

import { currentLevel, type AppViewProps } from '../../model/ui'

export function LoadForm({ project, levelId }: AppViewProps) {
  const { loads } = project
  const { seismic } = currentLevel(project, levelId)
  return (
    <div className="placeholder">
      <h2>Loads</h2>
      <p>
        S_DS {loads.sds}, I_e {loads.ie}, wind X {loads.windPlf.X} plf, wind Y {loads.windPlf.Y} plf, ρ {loads.rho},
        Ω₀ {loads.omega0}
      </p>
      <p>
        This Level: F_x {seismic.fxPsf} psf, weight {seismic.weightPsf} psf
      </p>
    </div>
  )
}
