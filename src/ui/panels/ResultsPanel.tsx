// Track A: results tables for the current Level and Load Case, or the Envelope (spec §6.5).
// So far: Level forces with F_px, Shear Lines, Lateral Elements, Collectors, Diaphragm Spans,
// Re-entrant Corners. Later tickets add wind, ASD, the Envelope, and Transfers.

import type { Level } from '../../model/project'
import { LOAD_CASES, type CaseResult, type FpxResult } from '../../model/results'
import { currentLevel, type AppViewProps } from '../../model/ui'
import './ResultsPanel.css'

// Until the toolbar picker lands (B3.2). A3.2 adds wind and the Envelope here.
const SWITCH_CASES = LOAD_CASES.filter((loadCase) => loadCase.id === 'SX' || loadCase.id === 'SY')

const GOVERNS_LABEL: Record<FpxResult['governs'], string> = {
  equation: 'Eq. 12.10-1',
  min: 'minimum',
  max: 'maximum',
  fx: 'F_x',
}

export function ResultsPanel({ project, results, levelId, caseId, setCaseId }: AppViewProps) {
  const level = currentLevel(project, levelId)
  const outlineError = results.warnings.find((w) => w.code === 'outline-invalid' && w.levelId === level.id)
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
      {outlineError ? (
        <p className="results-error">{outlineError.message}</p>
      ) : caseId === 'ENV' ? (
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
  const line = (lineId: string | null) => level.shearLines.find((sl) => sl.id === lineId)
  const sumFx = levelResult.lines.reduce((sum, l) => sum + l.reactionFx, 0)
  const sumFpx = levelResult.lines.reduce((sum, l) => sum + l.reactionFpx, 0)
  const { fpx } = levelResult

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
          {fpx && (
            <>
              <tr>
                <td>F_px, Eq. 12.10-1</td>
                <td>{kips(fpx.raw)}</td>
              </tr>
              <tr>
                <td>F_px minimum (0.2 S_DS I_e w)</td>
                <td>{kips(fpx.min)}</td>
              </tr>
              <tr>
                <td>F_px maximum (0.4 S_DS I_e w)</td>
                <td>{kips(fpx.max)}</td>
              </tr>
              <tr className="emphasis">
                <td>Diaphragm Force F_px ({GOVERNS_LABEL[fpx.governs]} governs)</td>
                <td>{kips(fpx.design)}</td>
              </tr>
            </>
          )}
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
              <th>Length</th>
              <th>R at F_x</th>
              <th>R at F_px</th>
              <th>v left</th>
              <th>v right</th>
            </tr>
          </thead>
          <tbody>
            {levelResult.lines.map((l) => (
              <tr key={l.lineId}>
                <td>
                  {line(l.lineId)?.name} <span className="muted">@ {feet(line(l.lineId)?.position ?? 0)}</span>
                </td>
                <td>{feet(l.length)}</td>
                <td>{kips(l.reactionFx)}</td>
                <td>{kips(l.reactionFpx)}</td>
                <td>{plf(l.unitShearLeft)}</td>
                <td>{plf(l.unitShearRight)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Σ</td>
              <td />
              <td>{kips(sumFx)}</td>
              <td>{kips(sumFpx)}</td>
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
      )}

      {levelResult.lines.length > 0 && (
        <>
          <h3>Lateral Elements (story shear at F_x)</h3>
          <table>
            <thead>
              <tr>
                <th>Line</th>
                <th>Element</th>
                <th>Length</th>
                <th>Force</th>
                <th>v</th>
              </tr>
            </thead>
            <tbody>
              {levelResult.lines.flatMap((l) =>
                l.elements.map((demand) => {
                  const element = line(l.lineId)?.lateralElements.find((e) => e.id === demand.elementId)
                  return (
                    <tr key={demand.elementId}>
                      <td>{line(l.lineId)?.name}</td>
                      <td>
                        {element?.kind === 'bracedFrame' ? 'Frame' : 'Wall'}{' '}
                        <span className="muted">
                          {element?.start}–{element?.end}
                        </span>
                      </td>
                      <td>{feet(element ? element.end - element.start : 0)}</td>
                      <td>{kips(demand.force)}</td>
                      <td>{plf(demand.unitShear)}</td>
                    </tr>
                  )
                }),
              )}
            </tbody>
          </table>

          <h3>Collectors (at F_px)</h3>
          <table>
            <thead>
              <tr>
                <th>Line</th>
                <th>Length</th>
                <th>max Collector force</th>
              </tr>
            </thead>
            <tbody>
              {levelResult.lines.map((l) => (
                <tr key={l.lineId}>
                  <td>{line(l.lineId)?.name}</td>
                  <td>{feet(l.length)}</td>
                  <td>{kips(l.collector.maxForce)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {levelResult.spans.length > 0 && (
        <>
          <h3>Diaphragm Spans (at F_px)</h3>
          <table>
            <thead>
              <tr>
                <th>Span</th>
                <th>L</th>
                <th>max V</th>
                <th>max v</th>
                <th>max M</th>
                <th>max Chord</th>
              </tr>
            </thead>
            <tbody>
              {levelResult.spans.map((span) => (
                <tr key={`${span.start}-${span.end}`}>
                  <td>
                    {line(span.fromLineId)?.name ?? 'free end'}→{line(span.toLineId)?.name ?? 'free end'}
                  </td>
                  <td>{feet(span.end - span.start)}</td>
                  <td>{kips(span.maxShear)}</td>
                  <td>{plf(span.maxUnitShear)}</td>
                  <td>{`${span.maxMoment.toFixed(1)} k-ft`}</td>
                  <td>{kips(span.maxChord)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {levelResult.corners.length > 0 && (
        <>
          <h3>Re-entrant Corners (at F_px)</h3>
          <table>
            <thead>
              <tr>
                <th>Corner</th>
                <th>s</th>
                <th>Drag force M/d</th>
              </tr>
            </thead>
            <tbody>
              {levelResult.corners.map((corner) => (
                <tr key={`${corner.point.x},${corner.point.y}`}>
                  <td>
                    ({corner.point.x}, {corner.point.y})
                  </td>
                  <td>{feet(corner.s)}</td>
                  <td>{kips(corner.force)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
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

function plf(value: number): string {
  return `${value.toFixed(1)} plf`
}
