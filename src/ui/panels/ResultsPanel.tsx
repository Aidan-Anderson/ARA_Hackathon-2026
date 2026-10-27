// Track A: results tables for the current Level and Load Case, or the Envelope (spec §6.5).
// Every Demand shows strength with ASD (× asdFactor) beneath it. Clicking a row selects the
// element for the Detail panel.

import type { Level, Project } from '../../model/project'
import { LOAD_CASES, type CaseResult, type EnvelopeEntry, type FpxResult, type Results } from '../../model/results'
import { currentLevel, type AppViewProps, type CaseView, type Selection } from '../../model/ui'
import { Demand } from './Demand'
import { selectableRow } from './selection'
import './ResultsPanel.css'

type Selecting = Pick<AppViewProps, 'selection' | 'setSelection'>

const CASE_VIEWS: { id: CaseView; label: string }[] = [
  ...LOAD_CASES.map(({ id, label }) => ({ id, label })),
  { id: 'ENV', label: 'Envelope' },
]

const GOVERNS_LABEL: Record<FpxResult['governs'], string> = {
  equation: 'Eq. 12.10-1',
  min: 'minimum',
  max: 'maximum',
  fx: 'F_x',
}

export function ResultsPanel({ project, results, levelId, caseId, setCaseId, selection, setSelection }: AppViewProps) {
  const level = currentLevel(project, levelId)
  const selecting: Selecting = { selection, setSelection }
  const outlineError = results.warnings.find((w) => w.code === 'outline-invalid' && w.levelId === level.id)
  return (
    <div className="results">
      <div className="case-switch">
        {CASE_VIEWS.map((view) => (
          <button key={view.id} className={view.id === caseId ? 'active' : undefined} onClick={() => setCaseId(view.id)}>
            {view.label}
          </button>
        ))}
      </div>
      {outlineError ? (
        <p className="results-error">{outlineError.message}</p>
      ) : caseId === 'ENV' ? (
        <EnvelopeTable project={project} level={level} results={results} selecting={selecting} />
      ) : (
        <LevelTables levels={project.levels} level={level} caseResult={results.cases[caseId]} selecting={selecting} />
      )}
    </div>
  )
}

function LevelTables({
  levels,
  level,
  caseResult,
  selecting,
}: {
  levels: Level[]
  level: Level
  caseResult: CaseResult
  selecting: Selecting
}) {
  const levelResult = caseResult.levels.find((result) => result.levelId === level.id)
  if (!levelResult) return null
  const asd = caseResult.asdFactor
  const wind = caseResult.caseId === 'WX' || caseResult.caseId === 'WY'
  const line = (lineId: string | null) => level.shearLines.find((sl) => sl.id === lineId)
  const sumFx = levelResult.lines.reduce((sum, l) => sum + l.reactionFx, 0)
  const sumFpx = levelResult.lines.reduce((sum, l) => sum + l.reactionFpx, 0)
  const sumStoryShear = levelResult.lines.reduce((sum, l) => sum + l.storyShear, 0)
  const { fpx } = levelResult

  return (
    <>
      <p className="results-note">
        Strength values, with ASD (× {asd}) in grey beneath.
      </p>

      <h3>Level forces: {level.name}</h3>
      <table>
        <tbody>
          <tr>
            <td>Net area</td>
            <td>{levelResult.netArea.toFixed(0)} sf</td>
          </tr>
          <tr>
            <td>{wind ? 'Wind on the Level (k)' : 'Story Force F_x (k)'}</td>
            <td>
              <Demand value={levelResult.fx} asd={asd} />
            </td>
          </tr>
          {!wind && (
            <tr>
              <td>Seismic weight (k)</td>
              <td>{levelResult.weight.toFixed(2)}</td>
            </tr>
          )}
          {fpx && (
            <>
              <tr>
                <td>F_px, Eq. 12.10-1 (k)</td>
                <td>{fpx.raw.toFixed(2)}</td>
              </tr>
              <tr>
                <td>F_px minimum, 0.2 S_DS I_e w (k)</td>
                <td>{fpx.min.toFixed(2)}</td>
              </tr>
              <tr>
                <td>F_px maximum, 0.4 S_DS I_e w (k)</td>
                <td>{fpx.max.toFixed(2)}</td>
              </tr>
              <tr className="emphasis">
                <td>Diaphragm Force F_px, {GOVERNS_LABEL[fpx.governs]} governs (k)</td>
                <td>
                  <Demand value={fpx.design} asd={asd} />
                </td>
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
              <th>{wind ? 'R (k)' : 'R at F_x (k)'}</th>
              {!wind && <th>R at F_px (k)</th>}
              <th>Story shear (k)</th>
              <th>v left (plf)</th>
              <th>v right (plf)</th>
            </tr>
          </thead>
          <tbody>
            {levelResult.lines.map((l) => (
              <tr key={l.lineId} {...selectableRow(selecting, lineSelection(level, l.lineId))}>
                <td>
                  {line(l.lineId)?.name} <span className="muted">@ {line(l.lineId)?.position}</span>
                  {!l.continuesBelow && <span className="tag">stops ↓</span>}
                </td>
                <td>
                  <Demand value={l.reactionFx} asd={asd} />
                </td>
                {!wind && (
                  <td>
                    <Demand value={l.reactionFpx} asd={asd} />
                  </td>
                )}
                <td>
                  <Demand value={l.storyShear} asd={asd} />
                </td>
                <td>
                  <Demand value={l.unitShearLeft} asd={asd} digits={1} />
                </td>
                <td>
                  <Demand value={l.unitShearRight} asd={asd} digits={1} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Σ</td>
              <td>
                <Demand value={sumFx} asd={asd} />
              </td>
              {!wind && (
                <td>
                  <Demand value={sumFpx} asd={asd} />
                </td>
              )}
              <td>
                <Demand value={sumStoryShear} asd={asd} />
              </td>
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
      )}

      {levelResult.lines.length > 0 && (
        <>
          <h3>Lateral Elements (story shear{wind ? '' : ' at F_x'})</h3>
          <table>
            <thead>
              <tr>
                <th>Line</th>
                <th>Element</th>
                <th>Length (ft)</th>
                <th>Force (k)</th>
                <th>v (plf)</th>
              </tr>
            </thead>
            <tbody>
              {levelResult.lines.flatMap((l) =>
                l.elements.map((demand) => {
                  const element = line(l.lineId)?.lateralElements.find((e) => e.id === demand.elementId)
                  return (
                    <tr
                      key={demand.elementId}
                      {...selectableRow(selecting, {
                        kind: 'lateralElement',
                        levelId: level.id,
                        lineId: l.lineId,
                        id: demand.elementId,
                      })}
                    >
                      <td>{line(l.lineId)?.name}</td>
                      <td>
                        {element?.kind === 'bracedFrame' ? 'Frame' : 'Wall'}{' '}
                        <span className="muted">
                          {element?.start}–{element?.end}
                        </span>
                      </td>
                      <td>{(element ? element.end - element.start : 0).toFixed(1)}</td>
                      <td>
                        <Demand value={demand.force} asd={asd} />
                      </td>
                      <td>
                        <Demand value={demand.unitShear} asd={asd} digits={1} />
                      </td>
                    </tr>
                  )
                }),
              )}
            </tbody>
          </table>

          <h3>Collectors{wind ? '' : ' (at F_px)'}</h3>
          <table>
            <thead>
              <tr>
                <th>Line</th>
                <th>Length (ft)</th>
                <th>max Collector force (k)</th>
              </tr>
            </thead>
            <tbody>
              {levelResult.lines.map((l) => (
                <tr key={l.lineId} {...selectableRow(selecting, lineSelection(level, l.lineId))}>
                  <td>{line(l.lineId)?.name}</td>
                  <td>{l.length.toFixed(1)}</td>
                  <td>
                    <Demand value={l.collector.maxForce} asd={asd} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {levelResult.spans.length > 0 && (
        <>
          <h3>Diaphragm Spans{wind ? '' : ' (at F_px)'}</h3>
          <table>
            <thead>
              <tr>
                <th>Span</th>
                <th>L (ft)</th>
                <th>max V (k)</th>
                <th>max v (plf)</th>
                <th>max M (k-ft)</th>
                <th>max Chord (k)</th>
              </tr>
            </thead>
            <tbody>
              {levelResult.spans.map((span) => (
                <tr key={`${span.start}-${span.end}`}>
                  <td>
                    {line(span.fromLineId)?.name ?? 'free end'}→{line(span.toLineId)?.name ?? 'free end'}
                  </td>
                  <td>{(span.end - span.start).toFixed(1)}</td>
                  <td>
                    <Demand value={span.maxShear} asd={asd} />
                  </td>
                  <td>
                    <Demand value={span.maxUnitShear} asd={asd} digits={1} />
                  </td>
                  <td>
                    <Demand value={span.maxMoment} asd={asd} digits={1} />
                  </td>
                  <td>
                    <Demand value={span.maxChord} asd={asd} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {levelResult.transfersIn.length > 0 && (
        <>
          <h3>Transfers into this Diaphragm</h3>
          <table>
            <thead>
              <tr>
                <th>From</th>
                <th>At (ft)</th>
                <th>Force (k)</th>
                <th>Collector (plf)</th>
                <th>max Collector force (k)</th>
              </tr>
            </thead>
            <tbody>
              {levelResult.transfersIn.map((transfer) => {
                const fromLevel = levels.find((l) => l.id === transfer.fromLevelId)
                const fromLine = fromLevel?.shearLines.find((l) => l.id === transfer.fromLineId)
                return (
                  <tr
                    key={`${transfer.fromLevelId}:${transfer.fromLineId}`}
                    {...selectableRow(selecting, { kind: 'transfer', levelId: level.id, fromLineId: transfer.fromLineId })}
                  >
                    <td>
                      {fromLevel?.name}, line {fromLine?.name}
                    </td>
                    <td>{transfer.position.toFixed(1)}</td>
                    <td>
                      <Demand value={transfer.force} asd={asd} />
                    </td>
                    <td>
                      <Demand value={transfer.collectorPlf} asd={asd} digits={1} />
                    </td>
                    <td>
                      <Demand value={transfer.collector.maxForce} asd={asd} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}

      {levelResult.corners.length > 0 && (
        <>
          <h3>Re-entrant Corners{wind ? '' : ' (at F_px)'}</h3>
          <table>
            <thead>
              <tr>
                <th>Corner</th>
                <th>s (ft)</th>
                <th>Drag force M/d (k)</th>
              </tr>
            </thead>
            <tbody>
              {levelResult.corners.map((corner) => (
                <tr key={`${corner.point.x},${corner.point.y}`}>
                  <td>
                    ({corner.point.x}, {corner.point.y})
                  </td>
                  <td>{corner.s.toFixed(1)}</td>
                  <td>
                    <Demand value={corner.force} asd={asd} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  )
}

const KIND_ORDER: EnvelopeEntry['kind'][] = ['lateralElement', 'line', 'collector', 'transferCollector', 'span']

const QUANTITY: Record<EnvelopeEntry['quantity'], { label: string; unit: string; digits: number }> = {
  force: { label: 'Force', unit: 'k', digits: 2 },
  storyShear: { label: 'Story shear', unit: 'k', digits: 2 },
  collectorForce: { label: 'Collector force', unit: 'k', digits: 2 },
  unitShear: { label: 'Unit shear', unit: 'plf', digits: 1 },
  chord: { label: 'Chord', unit: 'k', digits: 2 },
}

function EnvelopeTable({
  project,
  level,
  results,
  selecting,
}: {
  project: Project
  level: Level
  results: Results
  selecting: Selecting
}) {
  const entries = results.envelope
    .filter((entry) => entry.levelId === level.id)
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
  if (entries.length === 0) return <p className="results-note">No results on this Level.</p>

  return (
    <>
      <p className="results-note">
        Governing Demand across SX, SY, WX, WY. Strength and ASD are enveloped separately, so the governing
        case can differ.
      </p>
      <h3>Envelope: {level.name}</h3>
      <table>
        <thead>
          <tr>
            <th>Element</th>
            <th>Quantity</th>
            <th>Strength</th>
            <th>ASD</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const { label, unit, digits } = QUANTITY[entry.quantity]
            const target = envelopeSelection(level, entry)
            return (
              <tr
                key={`${entry.kind}|${entry.refId}|${entry.quantity}`}
                {...(target ? selectableRow(selecting, target) : {})}
              >
                <td>{envelopeName(project, level, entry)}</td>
                <td>{label}</td>
                <td>
                  {entry.strength.value.toFixed(digits)} {unit} <span className="muted">{entry.strength.caseId}</span>
                </td>
                <td>
                  {entry.asd.value.toFixed(digits)} {unit} <span className="muted">{entry.asd.caseId}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}

function lineSelection(level: Level, lineId: string): Selection {
  return { kind: 'shearLine', levelId: level.id, id: lineId }
}

/** What an Envelope row selects. Spans have no Detail view, so they select nothing. */
function envelopeSelection(level: Level, entry: EnvelopeEntry): Selection {
  switch (entry.kind) {
    case 'lateralElement': {
      const line = level.shearLines.find((l) => l.lateralElements.some((e) => e.id === entry.refId))
      return line ? { kind: 'lateralElement', levelId: level.id, lineId: line.id, id: entry.refId } : null
    }
    case 'line':
    case 'collector':
      return lineSelection(level, entry.refId)
    case 'transferCollector':
      return { kind: 'transfer', levelId: level.id, fromLineId: entry.refId.split(':')[1] }
    case 'span':
      return null
  }
}

function envelopeName(project: Project, level: Level, entry: EnvelopeEntry): string {
  const lineName = (lineId: string, onLevel: Level = level) =>
    lineId === 'free' ? 'free end' : (onLevel.shearLines.find((line) => line.id === lineId)?.name ?? lineId)
  switch (entry.kind) {
    case 'lateralElement': {
      const line = level.shearLines.find((l) => l.lateralElements.some((e) => e.id === entry.refId))
      const element = line?.lateralElements.find((e) => e.id === entry.refId)
      return `${line?.name ?? '?'}: ${element?.kind === 'bracedFrame' ? 'Frame' : 'Wall'} ${element?.start}–${element?.end}`
    }
    case 'line':
      return `Line ${lineName(entry.refId)}`
    case 'collector':
      return `Line ${lineName(entry.refId)} Collector`
    case 'span': {
      const [from, to] = entry.refId.split('→')
      return `Span ${lineName(from)}→${lineName(to)}`
    }
    case 'transferCollector': {
      const [fromLevelId, fromLineId] = entry.refId.split(':')
      const fromLevel = project.levels.find((l) => l.id === fromLevelId)
      return `Transfer from ${fromLevel?.name ?? '?'} line ${fromLevel ? lineName(fromLineId, fromLevel) : '?'}`
    }
  }
}
