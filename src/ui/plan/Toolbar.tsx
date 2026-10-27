// Track B: mode/tool buttons, Level picker, Load Case picker, Strength/ASD, Save/Load (spec §6.1).
// Tickets B1.1, B3.2, B4.1, B4.2. Placeholder from P0.2.

import { currentLevel, type AppViewProps } from '../../model/ui'

export function Toolbar({ project, levelId, caseId, showAsd }: AppViewProps) {
  return (
    <div className="placeholder">
      <h2>Toolbar</h2>
      <p>
        {project.name} · Level: {currentLevel(project, levelId).name} · Case: {caseId} · {showAsd ? 'ASD' : 'Strength'}
      </p>
    </div>
  )
}
