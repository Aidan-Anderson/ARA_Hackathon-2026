// Track A: warnings bar for the current Level (spec §6.1). Errors in red, warnings in amber.

import { currentLevel, type AppViewProps } from '../../model/ui'
import './Warnings.css'

export function Warnings({ project, results, levelId }: AppViewProps) {
  const level = currentLevel(project, levelId)
  const here = results.warnings
    .filter((warning) => !warning.levelId || warning.levelId === level.id)
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1))
  const elsewhere = results.warnings.length - here.length

  return (
    <div className="warnings">
      <strong>Warnings</strong>
      {here.length === 0 ? (
        <span className="warnings-quiet">None on {level.name}</span>
      ) : (
        <ul>
          {here.map((warning, i) => (
            <li key={`${warning.code}|${warning.refId ?? ''}|${i}`} className={`warning is-${warning.severity}`}>
              {warning.message}
            </li>
          ))}
        </ul>
      )}
      {elsewhere > 0 && <span className="warnings-quiet">+{elsewhere} on other Levels</span>}
    </div>
  )
}
