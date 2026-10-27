import { describe, expect, it } from 'vitest'
import { t1, t2, t3 } from '../model/fixtures'
import type { Project } from '../model/project'
import { analyze } from './analyze'
import {
  applyStoryForces,
  calcStoryForcePsf,
  distributionExponent,
  elf,
  outlineNotches,
  reentrantIrregularity,
  seismicCoefficient,
  usgsLookup,
  type ElfResult,
} from './seismicCode'

/** The research worked example's parameters: S_D1 0.65, S1 0.55, T_L 8, R 6.5, C_t 0.02, x 0.75. */
function withCode(project: Project): Project {
  project.loads.seismicCode = { riskCategory: 'II', siteClass: 'D', sd1: 0.65, s1: 0.55, tl: 8, r: 6.5, ct: 0.02, xExp: 0.75 }
  return project
}

function elfOf(project: Project): ElfResult {
  const result = elf(project)
  if ('error' in result) throw new Error(result.error)
  return result
}

describe('ELF calc (A5.1)', () => {
  it('T2: T 0.189 s, C_s 0.200, V 60.0 k, k 1, F_x 30 / 30 → fxPsf 6.0 / 6.0', () => {
    const result = elfOf(withCode(t2()))
    expect(result.hn).toBe(20)
    expect(result.period).toBeCloseTo(0.189, 3)
    expect(result.cs).toBeCloseTo(0.2, 9)
    expect(result.csGoverns).toBe('Eq. 12.8-2')
    expect(result.totalWeight).toBeCloseTo(300, 6)
    expect(result.baseShear).toBeCloseTo(60.0, 6)
    expect(result.k).toBe(1)
    expect(result.levels.map((level) => level.hx)).toEqual([10, 20])
    expect(result.levels[0].fx).toBeCloseTo(30, 6)
    expect(result.levels[1].fx).toBeCloseTo(30, 6)
    expect(calcStoryForcePsf(withCode(t2()))!.map((psf) => Number(psf.toFixed(6)))).toEqual([6, 6])
  })

  it('T1 (h_n 16 ft): T 0.160 s, V 24.0 k, fxPsf 4.8', () => {
    const result = elfOf(withCode(t1()))
    expect(result.period).toBeCloseTo(0.16, 9)
    expect(result.baseShear).toBeCloseTo(24.0, 6)
    expect(result.levels[0].fxPsf).toBeCloseTo(4.8, 9)
  })

  it('writes the result back into each Level, and the analysis then uses it', () => {
    const project = withCode(t2())
    const updated = applyStoryForces(project, elfOf(project))
    expect(updated.levels.map((level) => level.seismic.fxPsf.toFixed(6))).toEqual(['6.000000', '6.000000'])
    expect(project.levels[0].seismic.fxPsf).toBe(6) // the original is untouched
    expect(analyze(updated).cases.SY.levels[1].fx).toBeCloseTo(30, 6)
  })

  it('asks for inputs when there are none', () => {
    expect(elf(t1())).toEqual({ error: 'Enter the code-calc inputs first.' })
    expect(calcStoryForcePsf(t1())).toBeNull()
  })

  it('C_s limits: upper limit, lower limit, and the S1 ≥ 0.6 limit', () => {
    const base = { sds: 1.3, sd1: 0.65, s1: 0.55, ie: 1, r: 6.5, tl: 8 }
    expect(seismicCoefficient({ ...base, period: 1.0 })).toEqual({ cs: 0.1, governs: 'upper limit, Eq. 12.8-3/4' })
    const longPeriod = seismicCoefficient({ ...base, period: 10 }) // T > T_L
    expect(longPeriod.cs).toBeCloseTo(Math.max((0.65 * 8) / (100 * 6.5), 0.044 * 1.3), 9)
    expect(longPeriod.governs).toBe('lower limit, Eq. 12.8-5')
    const nearFault = seismicCoefficient({ ...base, s1: 0.8, sd1: 0.1, period: 2 })
    expect(nearFault.cs).toBeCloseTo((0.5 * 0.8) / 6.5, 9)
    expect(nearFault.governs).toBe('S1 limit, Eq. 12.8-6')
  })

  it('k: 1 up to 0.5 s, 2 from 2.5 s, linear between', () => {
    expect(distributionExponent(0.3)).toBe(1)
    expect(distributionExponent(1.5)).toBe(1.5)
    expect(distributionExponent(3)).toBe(2)
  })
})

describe('USGS lookup (A5.1)', () => {
  const site = { latitude: 37.8044, longitude: -122.2712, riskCategory: 'II', siteClass: 'D' }
  const respond = (body: unknown, status = 200): typeof fetch =>
    (async () => new Response(JSON.stringify(body), { status })) as typeof fetch

  it('reads S_DS, S_D1, S1, SDC, and T_L from the response, and asks for the right site', async () => {
    let requested = ''
    const fetchImpl = (async (url: string | URL | Request) => {
      requested = String(url)
      return new Response(JSON.stringify({ response: { data: { sds: 1.27, sd1: 1.13, s1: 0.66, sdc: 'D', tl: 8 } } }))
    }) as typeof fetch
    expect(await usgsLookup(site, { fetchImpl })).toEqual({ sds: 1.27, sd1: 1.13, s1: 0.66, sdc: 'D', tl: 8 })
    expect(requested).toContain('https://earthquake.usgs.gov/ws/building-codes/asce7-22/calculate?')
    expect(requested).toContain('latitude=37.8044')
    expect(requested).toContain('riskCategory=II')
    expect(requested).toContain('siteClass=D')
  })

  it('explains a network error', async () => {
    const fetchImpl = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    await expect(usgsLookup(site, { fetchImpl })).rejects.toThrow('Could not reach USGS (Failed to fetch)')
  })

  it('explains an HTTP error', async () => {
    await expect(usgsLookup(site, { fetchImpl: respond({}, 400) })).rejects.toThrow('HTTP 400')
  })

  it('explains a response without the values (e.g. a null S_D1)', async () => {
    const fetchImpl = respond({ response: { data: { sds: 1.1, sd1: null, s1: 0.65, tl: 8 } } })
    await expect(usgsLookup(site, { fetchImpl })).rejects.toThrow('Enter them by hand')
  })

  it('gives up after the timeout', async () => {
    const fetchImpl = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) =>
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))),
      )) as typeof fetch
    await expect(usgsLookup(site, { fetchImpl, timeoutMs: 10 })).rejects.toThrow('did not answer within 0.01 s')
  })
})

describe('§12.3.3.4 re-entrant corner irregularity (A5.1)', () => {
  /** T3 with a short wall on line 1, so its Collector carries load. */
  function t3WithCollector(sdc?: 'C' | 'D') {
    const project = withCode(t3())
    project.loads.seismicCode!.sdc = sdc
    project.levels[0].shearLines.find((line) => line.name === '1')!.lateralElements[0].end = 25
    return project
  }

  it('finds the L-shape’s notch: 30 × 25 ft on a 60 × 50 plan', () => {
    expect(outlineNotches(t3().levels[0].outline)).toEqual([{ width: 30, depth: 25 }])
    expect(reentrantIrregularity(t3().levels[0].outline)).toBe(true)
    expect(reentrantIrregularity(t1().levels[0].outline)).toBe(false)
  })

  it('ignores a small notch (under 15% of the plan in one direction)', () => {
    const smallNotch = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 45 },
      { x: 50, y: 45 },
      { x: 50, y: 50 },
      { x: 0, y: 50 },
    ] // 50 × 5 ft notch: 5 ft is only 10% of the 50 ft depth
    expect(reentrantIrregularity(smallNotch)).toBe(false)
  })

  it('T3 in SDC D: warning, and seismic Collector Demands × 1.25', () => {
    const plain = analyze(t3WithCollector('C'))
    const irregular = analyze(t3WithCollector('D'))
    expect(plain.warnings.map((w) => w.code)).not.toContain('reentrant-irregularity')
    expect(irregular.warnings).toContainEqual(expect.objectContaining({ code: 'reentrant-irregularity', levelId: 'roof' }))

    const collector = (results: typeof plain) => results.cases.SY.levels[0].lines[0].collector
    expect(collector(plain).maxForce).toBeGreaterThan(0)
    expect(collector(irregular).maxForce).toBeCloseTo(1.25 * collector(plain).maxForce, 9)
    expect(collector(irregular).force.v.at(-1)).toBeCloseTo(0, 6) // still closes
    // The Envelope picks up the increase too.
    const envelopeEntry = irregular.envelope.find((e) => e.kind === 'collector' && e.refId === 'roof-1')!
    expect(envelopeEntry.strength.value).toBeCloseTo(collector(irregular).maxForce, 9)
  })

  it('leaves wind and the walls themselves unchanged', () => {
    const project = t3WithCollector('D')
    project.loads.windPlf.Y = 200
    const plain = analyze(t3WithCollector('C'))
    const plainWind = (() => {
      const p = t3WithCollector('C')
      p.loads.windPlf.Y = 200
      return analyze(p)
    })()
    const irregular = analyze(project)
    expect(irregular.cases.WY.levels[0].lines[0].collector.maxForce).toBeCloseTo(
      plainWind.cases.WY.levels[0].lines[0].collector.maxForce,
      9,
    )
    expect(irregular.cases.SY.levels[0].lines[0].elements[0].force).toBeCloseTo(
      plain.cases.SY.levels[0].lines[0].elements[0].force,
      9,
    )
  })
})
