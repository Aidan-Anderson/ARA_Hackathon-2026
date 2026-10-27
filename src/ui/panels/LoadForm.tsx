// Track B: building and Level inputs, plus the Grid editor (spec §6.4).
// Ticket B1.1.

import { useState, type ReactNode } from 'react'
import type { Level, Loads } from '../../model/project'
import { currentLevel, type AppViewProps } from '../../model/ui'
import { updateLevel } from '../plan/edit'
import { gridExtents, gridOutline, parseSpacings } from '../plan/grid'
import './LoadForm.css'

export function LoadForm({ project, setProject, levelId }: AppViewProps) {
  const { loads, grid } = project
  const level = currentLevel(project, levelId)
  const extents = gridExtents(grid)

  const setLoads = (change: Partial<Loads>) => setProject((p) => ({ ...p, loads: { ...p.loads, ...change } }))
  const setWind = (axis: 'X' | 'Y', plf: number) =>
    setProject((p) => ({ ...p, loads: { ...p.loads, windPlf: { ...p.loads.windPlf, [axis]: plf } } }))
  const setLevel = (change: (level: Level) => Level) => setProject((p) => updateLevel(p, levelId, change))
  const setSeismic = (change: Partial<Level['seismic']>) =>
    setLevel((l) => ({ ...l, seismic: { ...l.seismic, ...change } }))

  return (
    <div className="load-form">
      <fieldset>
        <legend>Building</legend>
        <NumberField
          label={
            <>
              S<sub>DS</sub>
            </>
          }
          unit="g"
          value={loads.sds}
          parse={nonNegative}
          onChange={(sds) => setLoads({ sds })}
        />
        <NumberField
          label={
            <>
              I<sub>e</sub>
            </>
          }
          value={loads.ie}
          parse={positive}
          onChange={(ie) => setLoads({ ie })}
        />
        <NumberField
          label="Wind X"
          unit="plf"
          title="Strength level, applied to every Level"
          value={loads.windPlf.X}
          parse={nonNegative}
          onChange={(plf) => setWind('X', plf)}
        />
        <NumberField
          label="Wind Y"
          unit="plf"
          title="Strength level, applied to every Level"
          value={loads.windPlf.Y}
          parse={nonNegative}
          onChange={(plf) => setWind('Y', plf)}
        />
        <NumberField label="ρ" value={loads.rho} parse={positive} onChange={(rho) => setLoads({ rho })} />
        <NumberField label="Ω₀" value={loads.omega0} parse={positive} onChange={(omega0) => setLoads({ omega0 })} />
      </fieldset>

      {/* Keyed so a half-typed value doesn't carry over to another Level. */}
      <fieldset key={level.id}>
        <legend>Current Level</legend>
        <Field
          label="Name"
          value={level.name}
          format={(name) => name}
          parse={nonBlank}
          onChange={(name) => setLevel((l) => ({ ...l, name }))}
        />
        <NumberField
          label="Story height"
          unit="ft"
          title="Height of the Story below this Level"
          value={level.storyHeight}
          parse={positive}
          onChange={(storyHeight) => setLevel((l) => ({ ...l, storyHeight }))}
        />
        <NumberField
          label={
            <>
              F<sub>x</sub>
            </>
          }
          unit="psf"
          title="Story Force, psf of net area"
          value={level.seismic.fxPsf}
          parse={nonNegative}
          onChange={(fxPsf) => setSeismic({ fxPsf })}
        />
        <NumberField
          label="Seismic weight"
          unit="psf"
          title="psf of net area"
          value={level.seismic.weightPsf}
          parse={nonNegative}
          onChange={(weightPsf) => setSeismic({ weightPsf })}
        />
      </fieldset>

      <fieldset>
        <legend>Grid</legend>
        <Field
          label="X spacings"
          unit="ft"
          title="Between numbered Gridlines 1, 2, 3…, left to right"
          placeholder="20, 20, 30, 30"
          value={grid.xSpacings}
          format={formatSpacings}
          parse={parseSpacings}
          onChange={(xSpacings) => setProject((p) => ({ ...p, grid: { ...p.grid, xSpacings } }))}
        />
        <Field
          label="Y spacings"
          unit="ft"
          title="Between lettered Gridlines A, B, C…, bottom to top"
          placeholder="25, 25"
          value={grid.ySpacings}
          format={formatSpacings}
          parse={parseSpacings}
          onChange={(ySpacings) => setProject((p) => ({ ...p, grid: { ...p.grid, ySpacings } }))}
        />
        <div className="load-form-action">
          <button
            type="button"
            onClick={() => setProject((p) => updateLevel(p, levelId, (l) => ({ ...l, outline: gridOutline(p.grid) })))}
          >
            Outline = grid extents
          </button>
          <span className="load-form-note">
            {extents.x} × {extents.y} ft
          </span>
        </div>
      </fieldset>
    </div>
  )
}

interface FieldProps<T> {
  label: ReactNode
  unit?: string
  title?: string
  placeholder?: string
  value: T
  format: (value: T) => string
  /** null while the text isn't a valid value yet. */
  parse: (text: string) => T | null
  onChange: (value: T) => void
}

/**
 * A text input that shows the project's value, keeps whatever is typed, and writes to the project
 * each time the text parses. Text that doesn't parse is marked invalid and dropped on blur.
 */
function Field<T>({ label, unit, title, placeholder, value, format, parse, onChange }: FieldProps<T>) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <label className="field" title={title}>
      <span className="field-label">{label}</span>
      <input
        type="text"
        value={draft ?? format(value)}
        placeholder={placeholder}
        aria-invalid={draft !== null && parse(draft) === null}
        onChange={(event) => {
          setDraft(event.target.value)
          const parsed = parse(event.target.value)
          if (parsed !== null) onChange(parsed)
        }}
        onBlur={() => setDraft(null)}
      />
      <span className="field-unit">{unit}</span>
    </label>
  )
}

function NumberField(props: Omit<FieldProps<number>, 'format'>) {
  return <Field {...props} format={String} />
}

function toNumber(text: string): number | null {
  const value = Number(text)
  return text.trim() !== '' && Number.isFinite(value) ? value : null
}

function nonNegative(text: string): number | null {
  const value = toNumber(text)
  return value !== null && value >= 0 ? value : null
}

function positive(text: string): number | null {
  const value = toNumber(text)
  return value !== null && value > 0 ? value : null
}

function nonBlank(text: string): string | null {
  return text.trim() !== '' ? text : null
}

function formatSpacings(spacings: number[]): string {
  return spacings.join(', ')
}
