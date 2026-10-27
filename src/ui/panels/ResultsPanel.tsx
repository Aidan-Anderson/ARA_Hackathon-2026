// Track A: results tables for the current Level and Load Case, or the Envelope (spec §6.5).
// A1.1: Level forces and Diaphragm Reactions. Later tickets add F_px, spans, elements, Collectors, ASD.

import type { Level } from '../../model/project'
import { LOAD_CASES, type CaseResult } from '../../model/results'
import { currentLevel, type AppViewProps } from '../../model/ui'
import './ResultsPanel.css'

// Until the toolbar picker lands (B3.2). A3.2 adds wind and the Envelope here.
const SWITCH_CASES = LOAD_CASES.filter((loadCase) => loadCase.id === 'SX' || loadCase.id === 'SY')

export function ResultsPanel({ project, results, levelId, caseId, setCaseId }: AppViewProps) {
  const level = currentLevel(project, levelId)
  return (
    <div className="results">
      <div className="case-switch">
        {SWITCH_CASES.map((loadCase) => (
          <button
            key={loadCase.id}
            className={loadCase.id === caseId ? 'active' : undefined}
            onClick={() => setCaseId(loadCase.id)}
          >
            {loadCase.label}
          </button>
        ))}
      </div>
      {caseId === 'ENV' ? (
        <p className="results-note">The Envelope view arrives with A3.2.</p>
      ) : (
        <LevelTables level={level} caseResult={results.cases[caseId]} />
      )}
    </div>
  )
}

function LevelTables({ level, caseResult }: { level: Level; caseResult: CaseResult }) {
  const levelResult = caseResult.levels.find((result) => result.levelId === level.id)
  if (!levelResult) return null
  const lineName = (lineId: string) => level.shearLines.find((line) => line.id === lineId)?.name ?? lineId
  const reactionSum = levelResult.lines.reduce((sum, line) => sum + line.reactionFx, 0)

  return (
    <>
      <h3>Level forces: {level.name}</h3>
      <table>
        <tbody>
          <tr>
            <td>Net area</td>
            <td>{levelResult.netArea.toFixed(0)} sf</td>
          </tr>
          <tr>
            <td>Story Force F_x</td>
            <td>{kips(levelResult.fx)}</td>
          </tr>
          <tr>
            <td>Seismic weight</td>
            <td>{kips(levelResult.weight)}</td>
          </tr>
        </tbody>
      </table>

      <h3>Shear Lines ({caseResult.direction})</h3>
      {levelResult.lines.length === 0 ? (
        <p className="results-note">Needs at least two Shear Lines in {caseResult.direction}.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Line</th>
              <th>Position</th>
              <th>Length</th>
              <th>Reaction F_x</th>
            </tr>
          </thead>
          <tbody>
            {levelResult.lines.map((line) => (
              <tr key={line.lineId}>
                <td>{lineName(line.lineId)}</td>
                <td>{feet(level.shearLines.find((sl) => sl.id === line.lineId)?.position ?? 0)}</td>
                <td>{feet(line.length)}</td>
                <td>{kips(line.reactionFx)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Σ</td>
              <td />
              <td />
              <td>{kips(reactionSum)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </>
  )
}

function kips(value: number): string {
  return `${value.toFixed(2)} k`
}

function feet(value: number): string {
  return `${value.toFixed(1)} ft`
}
