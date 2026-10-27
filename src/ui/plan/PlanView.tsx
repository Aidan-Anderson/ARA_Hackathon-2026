// Track B: SVG plan view, tools, and the results overlay (spec §6.2, §6.3).
// Tickets B1.1, B2.x, B3.x, B4.1, B5.1. Placeholder from P0.2.

import { currentLevel, type AppViewProps } from '../../model/ui'

export function PlanView({ project, levelId }: AppViewProps) {
  const level = currentLevel(project, levelId)
  return (
    <div className="placeholder">
      <h2>Plan view</h2>
      <p>
        {level.name}: {level.outline.length}-point outline, {level.shearLines.length} Shear Lines,{' '}
        {level.openings.length} Openings
      </p>
    </div>
  )
}
