// Track B (B1.1): building and Level inputs, plus the Grid editor (spec §6.4).

import type { Level, Loads } from '../../model/project'
import { currentLevel, type AppViewProps } from '../../model/ui'
import { setGrid, setOutline, updateLevel } from '../plan/edit'
import { formatSpacings, gridRectangle, parseSpacings } from '../plan/grid'
import { NumberField, TextField } from './fields'
import './ResultsPanel.css'

export function LoadForm({ project, setProject, levelId }: AppViewProps) {
  const level = currentLevel(project, levelId)
  const { loads, grid } = project
  const setLoads = (change: Partial<Loads>) => setProject((p) => ({ ...p, loads: { ...p.loads, ...change } }))
  const setWind = (change: Partial<Loads['windPlf']>) =>
    setProject((p) => ({ ...p, loads: { ...p.loads, windPlf: { ...p.loads.windPlf, ...change } } }))
  const setLevel = (change: (level: Level) => Level) => setProject((p) => updateLevel(p, level.id, change))
  const gridOutline = gridRectangle(grid)

  return (
    <div className="results load-form">
      <h3>Building</h3>
      <div className="form-grid">
        <NumberField label="S_DS" value={loads.sds} onCommit={(sds) => sds !== undefined && setLoads({ sds })} />
        <NumberField label="I_e" value={loads.ie} onCommit={(ie) => ie !== undefined && setLoads({ ie })} />
        <span />
        <NumberField label="Wind X (plf)" value={loads.windPlf.X} onCommit={(X) => X !== undefined && setWind({ X })} />
        <NumberField label="Wind Y (plf)" value={loads.windPlf.Y} onCommit={(Y) => Y !== undefined && setWind({ Y })} />
        <span />
        <NumberField label="ρ" value={loads.rho} onCommit={(rho) => rho !== undefined && setLoads({ rho })} />
        <NumberField label="Ω₀" value={loads.omega0} onCommit={(omega0) => omega0 !== undefined && setLoads({ omega0 })} />
      </div>
      <p className="results-note">Strength-level loads. Wind applies to every Level.</p>

      <h3>Level: {level.name}</h3>
      <div className="form-grid">
        <TextField
          label="Name"
          value={level.name}
          onCommit={(name) => {
            if (!name.trim()) return false
            setLevel((l) => ({ ...l, name: name.trim() }))
            return true
          }}
        />
        <NumberField
          label="Story height (ft)"
          value={level.storyHeight}
          onCommit={(storyHeight) => storyHeight !== undefined && setLevel((l) => ({ ...l, storyHeight }))}
        />
        <span />
        <NumberField
          label="F_x (psf)"
          value={level.seismic.fxPsf}
          onCommit={(fxPsf) => fxPsf !== undefined && setLevel((l) => ({ ...l, seismic: { ...l.seismic, fxPsf } }))}
        />
        <NumberField
          label="Seismic weight (psf)"
          value={level.seismic.weightPsf}
          onCommit={(weightPsf) =>
            weightPsf !== undefined && setLevel((l) => ({ ...l, seismic: { ...l.seismic, weightPsf } }))
          }
        />
      </div>
      <p className="results-note">F_x is strength level with C_s applied. The Code calc tab can calculate it.</p>

      <h3>Grid</h3>
      <div className="form-grid">
        <TextField
          wide
          label="Numbered Gridlines 1, 2, 3… spacing along x (ft)"
          value={formatSpacings(grid.xSpacings)}
          onCommit={(text) => {
            const xSpacings = parseSpacings(text)
            if (!xSpacings) return false
            setProject((p) => setGrid(p, { ...p.grid, xSpacings }))
            return true
          }}
        />
        <TextField
          wide
          label="Lettered Gridlines A, B, C… spacing along y (ft)"
          value={formatSpacings(grid.ySpacings)}
          onCommit={(text) => {
            const ySpacings = parseSpacings(text)
            if (!ySpacings) return false
            setProject((p) => setGrid(p, { ...p.grid, ySpacings }))
            return true
          }}
        />
      </div>
      <p className="results-note">Comma-separated, e.g. 20, 20, 30. Use 3@20 for repeats.</p>
      <div className="form-actions">
        <button disabled={!gridOutline} onClick={() => gridOutline && setProject((p) => setOutline(p, level.id, gridOutline))}>
          Outline = grid extents
        </button>
      </div>
    </div>
  )
}
