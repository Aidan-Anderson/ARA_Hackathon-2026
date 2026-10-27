// Track A: ASCE 7-22 ELF calc and USGS site lookup, writing F_x into each Level (spec §5.14, A5.1).

import { useState } from 'react'
import { applyStoryForces, DEFAULT_SEISMIC_CODE, elf, usgsLookup } from '../../engine/seismicCode'
import type { Project, SeismicCodeInputs } from '../../model/project'
import type { AppViewProps } from '../../model/ui'
import { NumberField, SelectField } from './fields'
import './ResultsPanel.css'

const RISK_CATEGORIES: SeismicCodeInputs['riskCategory'][] = ['I', 'II', 'III', 'IV']
const SITE_CLASSES = ['A', 'B', 'B-estimated', 'BC', 'C', 'CD', 'D', 'D-default', 'DEFAULT', 'DE', 'E']
const SDCS = ['', 'A', 'B', 'C', 'D', 'E', 'F'] as const

type Lookup = { state: 'idle' } | { state: 'loading' } | { state: 'done'; message: string } | { state: 'error'; message: string }

export function SeismicCodePanel({ project, setProject }: AppViewProps) {
  const code = project.loads.seismicCode ?? DEFAULT_SEISMIC_CODE
  const [lookup, setLookup] = useState<Lookup>({ state: 'idle' })
  const result = elf({ ...project, loads: { ...project.loads, seismicCode: code } })

  const setCode = (change: Partial<SeismicCodeInputs>) =>
    setProject((p) => ({ ...p, loads: { ...p.loads, seismicCode: { ...(p.loads.seismicCode ?? DEFAULT_SEISMIC_CODE), ...change } } }))
  const setLoads = (change: Partial<Pick<Project['loads'], 'sds' | 'ie'>>) =>
    setProject((p) => ({ ...p, loads: { ...p.loads, ...change } }))

  async function lookUp() {
    if (code.latitude === undefined || code.longitude === undefined) {
      setLookup({ state: 'error', message: 'Enter the latitude and longitude first.' })
      return
    }
    setLookup({ state: 'loading' })
    try {
      const site = await usgsLookup({
        latitude: code.latitude,
        longitude: code.longitude,
        riskCategory: code.riskCategory,
        siteClass: code.siteClass,
      })
      setProject((p) => ({
        ...p,
        loads: {
          ...p.loads,
          sds: site.sds,
          seismicCode: { ...(p.loads.seismicCode ?? code), sd1: site.sd1, s1: site.s1, tl: site.tl, sdc: site.sdc },
        },
      }))
      setLookup({
        state: 'done',
        message: `Filled from USGS (ASCE 7-22, Risk Category ${code.riskCategory}, Site Class ${code.siteClass}).`,
      })
    } catch (error) {
      setLookup({ state: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  return (
    <div className="results code-calc">
      <h3>Site</h3>
      <div className="form-grid">
        <NumberField label="Latitude" value={code.latitude} onCommit={(latitude) => setCode({ latitude })} />
        <NumberField label="Longitude" value={code.longitude} onCommit={(longitude) => setCode({ longitude })} />
        <SelectField
          label="Risk Category"
          value={code.riskCategory}
          options={RISK_CATEGORIES}
          onChange={(riskCategory) => setCode({ riskCategory: riskCategory as SeismicCodeInputs['riskCategory'] })}
        />
        <SelectField label="Site Class" value={code.siteClass} options={SITE_CLASSES} onChange={(siteClass) => setCode({ siteClass })} />
      </div>
      <div className="form-actions">
        <button onClick={lookUp} disabled={lookup.state === 'loading'}>
          {lookup.state === 'loading' ? 'Looking up…' : 'Look up from site (USGS)'}
        </button>
      </div>
      {(lookup.state === 'done' || lookup.state === 'error') && (
        <p className={lookup.state === 'error' ? 'results-error' : 'results-note'}>{lookup.message}</p>
      )}

      <h3>Seismic parameters</h3>
      <div className="form-grid">
        <NumberField label="S_DS" value={project.loads.sds} onCommit={(sds) => sds !== undefined && setLoads({ sds })} />
        <NumberField label="S_D1" value={code.sd1} onCommit={(sd1) => sd1 !== undefined && setCode({ sd1 })} />
        <NumberField label="S1" value={code.s1} onCommit={(s1) => s1 !== undefined && setCode({ s1 })} />
        <NumberField label="T_L (s)" value={code.tl} onCommit={(tl) => tl !== undefined && setCode({ tl })} />
        <NumberField label="I_e" value={project.loads.ie} onCommit={(ie) => ie !== undefined && setLoads({ ie })} />
        <SelectField
          label="SDC"
          value={code.sdc ?? ''}
          options={SDCS}
          onChange={(sdc) => setCode({ sdc: sdc === '' ? undefined : (sdc as SeismicCodeInputs['sdc']) })}
        />
        <NumberField label="R" value={code.r} onCommit={(r) => r !== undefined && setCode({ r })} />
        <NumberField label="C_t" value={code.ct} onCommit={(ct) => ct !== undefined && setCode({ ct })} />
        <NumberField label="x" value={code.xExp} onCommit={(xExp) => xExp !== undefined && setCode({ xExp })} />
      </div>

      <h3>ELF base shear</h3>
      {'error' in result ? (
        <p className="results-error">{result.error}</p>
      ) : (
        <>
          <table>
            <tbody>
              <tr>
                <td>Height h_n</td>
                <td>{result.hn.toFixed(1)} ft</td>
              </tr>
              <tr>
                <td>Period T_a = C_t h_n^x</td>
                <td>{result.period.toFixed(3)} s</td>
              </tr>
              <tr>
                <td>C_s ({result.csGoverns})</td>
                <td>{result.cs.toFixed(4)}</td>
              </tr>
              <tr>
                <td>Seismic weight W</td>
                <td>{result.totalWeight.toFixed(2)} k</td>
              </tr>
              <tr className="emphasis">
                <td>Base shear V = C_s W</td>
                <td>{result.baseShear.toFixed(2)} k</td>
              </tr>
              <tr>
                <td>Distribution exponent k</td>
                <td>{result.k.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <h3>Story Forces F_x</h3>
          <table>
            <thead>
              <tr>
                <th>Level</th>
                <th>h_x (ft)</th>
                <th>w_x (k)</th>
                <th>F_x (k)</th>
                <th>F_x (psf)</th>
                <th>In use</th>
              </tr>
            </thead>
            <tbody>
              {[...result.levels].reverse().map((calc) => {
                const level = project.levels.find((l) => l.id === calc.levelId)
                const inUse = level !== undefined && Math.abs(level.seismic.fxPsf - calc.fxPsf) < 0.005
                return (
                  <tr key={calc.levelId}>
                    <td>{level?.name}</td>
                    <td>{calc.hx.toFixed(1)}</td>
                    <td>{calc.wx.toFixed(2)}</td>
                    <td>{calc.fx.toFixed(2)}</td>
                    <td>{calc.fxPsf.toFixed(2)}</td>
                    <td>{inUse ? 'calculated ✓' : <span className="muted">{level?.seismic.fxPsf} psf</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="form-actions">
            <button onClick={() => setProject((p) => applyStoryForces(p, result))}>Use these F_x on every Level</button>
          </div>
        </>
      )}
    </div>
  )
}
