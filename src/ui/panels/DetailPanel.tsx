// Track A: the selected element in every Load Case plus the Envelope, with ρ (Lateral Elements) or
// Ω₀ (Collectors) applied to seismic cases only (spec §5.12, §6.5). Wind rows show E and 0.6·E.

import { isShortened, shearLineExtent } from '../../model/geometry'
import type { Axis, Level, Project } from '../../model/project'
import { resetLineLength } from '../plan/edit'
import { LOAD_CASES, type CaseResult, type LoadCaseId, type Results } from '../../model/results'
import type { AppViewProps, Selection } from '../../model/ui'
import { Demand } from './Demand'
import './ResultsPanel.css'

const SEISMIC = new Set<LoadCaseId>(['SX', 'SY'])

export function DetailPanel({ project, setProject, results, selection, setSelection }: AppViewProps) {
  if (!selection) {
    return (
      <div className="results">
        <p className="results-note">Click a row in Results, or an element on the plan, to see its details.</p>
      </div>
    )
  }
  const level = project.levels.find((l) => l.id === selection.levelId)
  return (
    <div className="results">
      <div className="detail-bar">
        <button onClick={() => setSelection(null)}>Clear selection</button>
      </div>
      {level ? (
        <Detail project={project} setProject={setProject} results={results} level={level} selection={selection} />
      ) : (
        <Gone />
      )}
    </div>
  )
}

function Detail({ selection, ...rest }: Omit<DetailProps<never>, 'selection' | 'levelIndex'> & { selection: NonNullable<Selection> }) {
  const props = { ...rest, levelIndex: rest.project.levels.indexOf(rest.level) }
  switch (selection.kind) {
    case 'lateralElement':
      return <ElementDetail {...props} selection={selection} />
    case 'shearLine':
      return <LineDetail {...props} selection={selection} />
    case 'transfer':
      return <TransferDetail {...props} selection={selection} />
    case 'opening':
      return <OpeningDetail {...props} selection={selection} />
  }
}

/** The selection points at something that was deleted or moved to another id. */
function Gone() {
  return <p className="results-note">The selected item no longer exists.</p>
}

interface DetailProps<K> {
  project: Project
  setProject: AppViewProps['setProject']
  results: Results
  level: Level
  levelIndex: number
  selection: Extract<Selection, { kind: K }>
}

function ElementDetail({ project, results, level, levelIndex, selection }: DetailProps<'lateralElement'>) {
  const line = level.shearLines.find((l) => l.id === selection.lineId)
  const element = line?.lateralElements.find((e) => e.id === selection.id)
  if (!line || !element) return <Gone />
  const demand = (c: CaseResult) =>
    c.levels[levelIndex]?.lines.find((l) => l.lineId === line.id)?.elements.find((e) => e.elementId === element.id)
  const { rho } = project.loads
  return (
    <>
      <h3>
        {element.kind === 'bracedFrame' ? 'Braced frame' : 'Shear wall'} on Shear Line {line.name}
      </h3>
      <p className="results-note">
        {level.name}, Story below · {element.start}–{element.end} ft along the line ({(element.end - element.start).toFixed(1)}{' '}
        ft) · Using ρ = {rho} from the Loads tab.
      </p>
      <FactoredTable title="Force" factor="ρ·E" unit="k" rows={designRows(results, line.direction, (c) => demand(c)?.force, rho)} />
      <FactoredTable
        title="Unit shear"
        factor="ρ·v"
        unit="plf"
        digits={1}
        rows={designRows(results, line.direction, (c) => demand(c)?.unitShear, rho)}
      />
    </>
  )
}

function LineDetail({ project, setProject, results, level, levelIndex, selection }: DetailProps<'shearLine'>) {
  const line = level.shearLines.find((l) => l.id === selection.id)
  if (!line) return <Gone />
  const lineResult = (c: CaseResult) => c.levels[levelIndex]?.lines.find((l) => l.lineId === line.id)
  const cases = LOAD_CASES.filter((loadCase) => loadCase.direction === line.direction)
  const any = cases.map((loadCase) => lineResult(results.cases[loadCase.id])).find(Boolean)
  const { omega0 } = project.loads
  const runs = shearLineExtent(level.outline, line)
  const shortened = isShortened(level.outline, line)
  const along = line.direction === 'Y' ? 'y' : 'x'
  return (
    <>
      <h3>
        Shear Line {line.name} ({line.direction})
      </h3>
      <p className="results-note">
        {level.name} · at {line.position} ft
        {runs && ` · runs ${along} ${runs[0].toFixed(1)}–${runs[1].toFixed(1)} ft (${(runs[1] - runs[0]).toFixed(1)} ft)`}
        {shortened ? ', shortened: it supports only the strip of Diaphragm it covers' : ', full depth'}
        {any && !any.continuesBelow ? ' · stops here, so its story shear transfers to the Level below' : ''}
      </p>
      {shortened && (
        <div className="form-actions">
          <button onClick={() => setProject((p) => resetLineLength(p, level.id, line.id))}>Use full depth</button>
        </div>
      )}
      {any && (
        <table>
          <thead>
            <tr>
              <th>Case</th>
              <th>R at F_x (k)</th>
              <th>R at F_px (k)</th>
              <th>Story shear (k)</th>
              <th>v left (plf)</th>
              <th>v right (plf)</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((loadCase) => {
              const result = lineResult(results.cases[loadCase.id])
              if (!result) return null
              const asd = loadCase.asdFactor
              return (
                <tr key={loadCase.id}>
                  <td>{loadCase.label}</td>
                  <td>
                    <Demand value={result.reactionFx} asd={asd} />
                  </td>
                  <td>
                    <Demand value={result.reactionFpx} asd={asd} />
                  </td>
                  <td>
                    <Demand value={result.storyShear} asd={asd} />
                  </td>
                  <td>
                    <Demand value={result.unitShearLeft} asd={asd} digits={1} />
                  </td>
                  <td>
                    <Demand value={result.unitShearRight} asd={asd} digits={1} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <p className="results-note">Collector: using Ω₀ = {omega0} from the Loads tab.</p>
      <FactoredTable
        title="Collector force"
        factor="Ω₀·E"
        unit="k"
        rows={designRows(results, line.direction, (c) => lineResult(c)?.collector.maxForce, omega0)}
      />
    </>
  )
}

function TransferDetail({ project, results, level, levelIndex, selection }: DetailProps<'transfer'>) {
  const fromLevel = project.levels[levelIndex + 1]
  const fromLine = fromLevel?.shearLines.find((l) => l.id === selection.fromLineId)
  if (!fromLevel || !fromLine) return <Gone />
  const transfer = (c: CaseResult) => c.levels[levelIndex]?.transfersIn.find((t) => t.fromLineId === fromLine.id)
  const cases = LOAD_CASES.filter((loadCase) => loadCase.direction === fromLine.direction)
  const { omega0 } = project.loads
  return (
    <>
      <h3>
        Transfer from {fromLevel.name}, Shear Line {fromLine.name}
      </h3>
      <p className="results-note">
        Into the {level.name} Diaphragm at {fromLine.position} ft. Collector: using Ω₀ = {omega0} from the Loads tab.
      </p>
      <table>
        <thead>
          <tr>
            <th>Case</th>
            <th>Transfer Force (k)</th>
            <th>Collector (plf)</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((loadCase) => {
            const result = transfer(results.cases[loadCase.id])
            if (!result) return null
            return (
              <tr key={loadCase.id}>
                <td>{loadCase.label}</td>
                <td>
                  <Demand value={result.force} asd={loadCase.asdFactor} />
                </td>
                <td>
                  <Demand value={result.collectorPlf} asd={loadCase.asdFactor} digits={1} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <FactoredTable
        title="Transfer Collector force"
        factor="Ω₀·E"
        unit="k"
        rows={designRows(results, fromLine.direction, (c) => transfer(c)?.collector.maxForce, omega0)}
      />
    </>
  )
}

function OpeningDetail({ level, selection }: DetailProps<'opening'>) {
  const opening = level.openings.find((o) => o.id === selection.id)
  if (!opening) return <Gone />
  const width = opening.xMax - opening.xMin
  const depth = opening.yMax - opening.yMin
  return (
    <>
      <h3>Opening</h3>
      <table>
        <tbody>
          <tr>
            <td>Level</td>
            <td>{level.name}</td>
          </tr>
          <tr>
            <td>Size</td>
            <td>
              {width.toFixed(1)} × {depth.toFixed(1)} ft
            </td>
          </tr>
          <tr>
            <td>Area</td>
            <td>{(width * depth).toFixed(0)} sf</td>
          </tr>
          <tr>
            <td>x</td>
            <td>
              {opening.xMin}–{opening.xMax} ft
            </td>
          </tr>
          <tr>
            <td>y</td>
            <td>
              {opening.yMin}–{opening.yMax} ft
            </td>
          </tr>
        </tbody>
      </table>
      <p className="results-note">Chord forces around Openings are not calculated.</p>
    </>
  )
}

interface DesignRow {
  caseId: LoadCaseId
  label: string
  /** Demand without factors. */
  e: number
  /** ρ·E or Ω₀·E for seismic; null for wind. */
  factored: number | null
  /** What design uses at strength: factored for seismic, E for wind. */
  design: number
  /** 0.7·factored for seismic, 0.6·E for wind. */
  asd: number
}

/** E for each Load Case in the element's direction, with the factor applied to seismic cases only. */
function designRows(
  results: Results,
  direction: Axis,
  value: (c: CaseResult) => number | undefined,
  factor: number,
): DesignRow[] {
  const rows: DesignRow[] = []
  for (const loadCase of LOAD_CASES) {
    if (loadCase.direction !== direction) continue
    const raw = value(results.cases[loadCase.id])
    if (raw === undefined) continue
    const e = Math.abs(raw)
    const factored = SEISMIC.has(loadCase.id) ? factor * e : null
    const design = factored ?? e
    rows.push({ caseId: loadCase.id, label: loadCase.label, e, factored, design, asd: design * loadCase.asdFactor })
  }
  return rows
}

function FactoredTable({
  title,
  factor,
  unit,
  rows,
  digits = 2,
}: {
  title: string
  factor: string
  unit: string
  rows: DesignRow[]
  digits?: number
}) {
  if (rows.length === 0) return null
  const strength = rows.reduce((best, row) => (row.design > best.design ? row : best))
  const asd = rows.reduce((best, row) => (row.asd > best.asd ? row : best))
  return (
    <>
      <h3>{title}</h3>
      <table>
        <thead>
          <tr>
            <th>Case</th>
            <th>E ({unit})</th>
            <th>
              {factor} ({unit})
            </th>
            <th>ASD ({unit})</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.caseId}>
              <td>{row.label}</td>
              <td>{row.e.toFixed(digits)}</td>
              <td>{row.factored === null ? '—' : row.factored.toFixed(digits)}</td>
              <td>{row.asd.toFixed(digits)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Envelope</td>
            <td />
            <td>
              {strength.design.toFixed(digits)} <span className="muted">{strength.caseId}</span>
            </td>
            <td>
              {asd.asd.toFixed(digits)} <span className="muted">{asd.caseId}</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </>
  )
}
