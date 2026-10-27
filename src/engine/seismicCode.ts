// ASCE 7-22 seismic code calc (docs/spec.md §5.14; research notes §3, formulas B1–B6):
// ELF base shear and its vertical distribution to F_x, the USGS site lookup, and the
// §12.3.3.4 re-entrant corner irregularity. The only engine module allowed to use the network.

import type { Point, Project, SeismicCodeInputs } from '../model/project'
import { uniqueSorted } from './math'
import { levelSections } from './sections'

export type Sdc = NonNullable<SeismicCodeInputs['sdc']>

export interface ElfLevel {
  levelId: string
  /** sf */
  netArea: number
  /** kips, seismic weight w_x */
  wx: number
  /** ft above the base */
  hx: number
  /** kips, Story Force */
  fx: number
  /** F_x spread over the net area: what goes back into the Level's fxPsf */
  fxPsf: number
}

export interface ElfResult {
  /** ft, building height */
  hn: number
  /** s, approximate period T_a = C_t · h_n^x */
  period: number
  cs: number
  csGoverns: 'Eq. 12.8-2' | 'upper limit, Eq. 12.8-3/4' | 'lower limit, Eq. 12.8-5' | 'S1 limit, Eq. 12.8-6'
  /** kips */
  totalWeight: number
  /** kips, base shear V = C_s · W */
  baseShear: number
  /** vertical distribution exponent */
  k: number
  /** Bottom → top, like project.levels. */
  levels: ElfLevel[]
}

/** Starting values for a project that has no code-calc inputs yet. */
export const DEFAULT_SEISMIC_CODE: SeismicCodeInputs = {
  riskCategory: 'II',
  siteClass: 'D',
  sd1: 0,
  s1: 0,
  tl: 8,
  r: 6.5,
  ct: 0.02,
  xExp: 0.75,
}

/** T_a = C_t · h_n^x (§12.8.2.1). */
export function periodTa(hn: number, ct: number, xExp: number): number {
  return ct * hn ** xExp
}

/** C_s with its upper and lower limits (§12.8.1.1), and which one governs. */
export function seismicCoefficient(p: {
  sds: number
  sd1: number
  s1: number
  ie: number
  r: number
  tl: number
  period: number
}): { cs: number; governs: ElfResult['csGoverns'] } {
  const { sds, sd1, s1, ie, r, tl, period } = p
  let cs = (sds * ie) / r
  let governs: ElfResult['csGoverns'] = 'Eq. 12.8-2'
  const upper = period <= tl ? (sd1 * ie) / (period * r) : (sd1 * tl * ie) / (period ** 2 * r)
  if (cs > upper) {
    cs = upper
    governs = 'upper limit, Eq. 12.8-3/4'
  }
  const lower = Math.max(0.044 * sds * ie, 0.01)
  const s1Limit = s1 >= 0.6 ? (0.5 * s1 * ie) / r : 0
  if (cs < Math.max(lower, s1Limit)) {
    cs = Math.max(lower, s1Limit)
    governs = s1Limit > lower ? 'S1 limit, Eq. 12.8-6' : 'lower limit, Eq. 12.8-5'
  }
  return { cs, governs }
}

/** k = 1 for T ≤ 0.5 s, 2 for T ≥ 2.5 s, linear between (§12.8.3). */
export function distributionExponent(period: number): number {
  if (period <= 0.5) return 1
  if (period >= 2.5) return 2
  return 1 + (period - 0.5) / 2
}

/** The full ELF calc, or a message saying what's missing. */
export function elf(project: Project): ElfResult | { error: string } {
  const code = project.loads.seismicCode
  if (!code) return { error: 'Enter the code-calc inputs first.' }
  if (!(code.r > 0)) return { error: 'R must be greater than 0.' }

  let elevation = 0
  const base = project.levels.map((level) => {
    elevation += level.storyHeight
    const { netArea } = levelSections(level, 'Y')
    return { levelId: level.id, netArea, wx: (level.seismic.weightPsf / 1000) * netArea, hx: elevation }
  })
  const hn = elevation
  if (!(hn > 0)) return { error: 'Story heights must add up to more than 0.' }

  const period = periodTa(hn, code.ct, code.xExp)
  const { ie, sds } = project.loads
  const { cs, governs } = seismicCoefficient({ sds, sd1: code.sd1, s1: code.s1, ie, r: code.r, tl: code.tl, period })
  const totalWeight = base.reduce((sum, level) => sum + level.wx, 0)
  const baseShear = cs * totalWeight
  const k = distributionExponent(period)
  const sumWhk = base.reduce((sum, level) => sum + level.wx * level.hx ** k, 0)

  return {
    hn,
    period,
    cs,
    csGoverns: governs,
    totalWeight,
    baseShear,
    k,
    levels: base.map((level) => {
      const fx = sumWhk > 0 ? (baseShear * level.wx * level.hx ** k) / sumWhk : 0
      return { ...level, fx, fxPsf: level.netArea > 0 ? (fx * 1000) / level.netArea : 0 }
    }),
  }
}

/** The new fxPsf for each Level (bottom → top), or null if the inputs are incomplete. */
export function calcStoryForcePsf(project: Project): number[] | null {
  const result = elf(project)
  return 'error' in result ? null : result.levels.map((level) => level.fxPsf)
}

/** A copy of the project with each Level's fxPsf replaced by the ELF result. */
export function applyStoryForces(project: Project, result: ElfResult): Project {
  return {
    ...project,
    levels: project.levels.map((level, i) => ({
      ...level,
      seismic: { ...level.seismic, fxPsf: result.levels[i]?.fxPsf ?? level.seismic.fxPsf },
    })),
  }
}

// ---------------------------------------------------------------------------------------------
// USGS Seismic Design Web Services (research §2.10): free, no key, browser-callable.

export const USGS_ASCE7_22 = 'https://earthquake.usgs.gov/ws/building-codes/asce7-22/calculate'

export interface SiteValues {
  sds: number
  sd1: number
  s1: number
  tl: number
  sdc?: Sdc
}

const SDCS: Sdc[] = ['A', 'B', 'C', 'D', 'E', 'F']

/** Look up S_DS, S_D1, S1, T_L, and SDC for a site. Throws an Error with a message for the user. */
export async function usgsLookup(
  site: { latitude: number; longitude: number; riskCategory: string; siteClass: string },
  { fetchImpl = fetch, timeoutMs = 10_000 }: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<SiteValues> {
  const query = new URLSearchParams({
    latitude: String(site.latitude),
    longitude: String(site.longitude),
    riskCategory: site.riskCategory,
    siteClass: site.siteClass,
    title: 'Lateral Load Path',
  })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let response: Response
  try {
    response = await fetchImpl(`${USGS_ASCE7_22}?${query}`, { signal: controller.signal })
  } catch (error) {
    throw new Error(
      controller.signal.aborted
        ? `USGS did not answer within ${timeoutMs / 1000} s. Try again, or enter the values by hand.`
        : `Could not reach USGS (${error instanceof Error ? error.message : String(error)}). Enter the values by hand.`,
    )
  } finally {
    clearTimeout(timer)
  }
  if (!response.ok) {
    throw new Error(`USGS returned an error (HTTP ${response.status}). Check the coordinates, risk category, and site class.`)
  }

  const data = ((await response.json()) as { response?: { data?: Record<string, unknown> } })?.response?.data
  const number = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null)
  const [sds, sd1, s1, tl] = [data?.sds, data?.sd1, data?.s1, data?.tl].map(number)
  if (sds === null || sd1 === null || s1 === null || tl === null) {
    throw new Error('USGS did not return S_DS, S_D1, S1, and T_L for this site and site class. Enter them by hand.')
  }
  const sdc = SDCS.find((value) => value === data?.sdc)
  return { sds, sd1, s1, tl, ...(sdc ? { sdc } : {}) }
}

// ---------------------------------------------------------------------------------------------
// §12.3.3.4: re-entrant corner irregularity (horizontal Type 2) in SDC D–F.

/** Collector Demands on an irregular Level are multiplied by this for seismic. */
export const IRREGULARITY_COLLECTOR_FACTOR = 1.25

/** True for SDC D, E, F, where §12.3.3.4 applies. */
export function irregularityApplies(sdc: SeismicCodeInputs['sdc']): boolean {
  return sdc === 'D' || sdc === 'E' || sdc === 'F'
}

/**
 * Type 2 irregularity: some notch (bounding box minus outline) is wider than 15% of the plan width
 * AND deeper than 15% of the plan depth, i.e. both projections beyond the inside corner exceed 15%.
 */
export function reentrantIrregularity(outline: Point[]): boolean {
  const xs = outline.map((p) => p.x)
  const ys = outline.map((p) => p.y)
  const width = Math.max(...xs) - Math.min(...xs)
  const depth = Math.max(...ys) - Math.min(...ys)
  return outlineNotches(outline).some((notch) => notch.width > 0.15 * width && notch.depth > 0.15 * depth)
}

/** The pieces of the outline's bounding box that the outline doesn't cover, by their extents. */
export function outlineNotches(outline: Point[]): { width: number; depth: number }[] {
  const xs = uniqueSorted(outline.map((p) => p.x))
  const ys = uniqueSorted(outline.map((p) => p.y))
  // Grid cells between consecutive vertex coordinates are wholly inside or wholly outside.
  const outside = xs.slice(1).map((_, i) =>
    ys.slice(1).map((_, j) => !insidePolygon(outline, (xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2)),
  )
  const seen = outside.map((column) => column.map(() => false))
  const notches: { width: number; depth: number }[] = []
  outside.forEach((column, i0) =>
    column.forEach((isOutside, j0) => {
      if (!isOutside || seen[i0][j0]) return
      // Flood-fill one notch and keep its extent.
      let [iMin, iMax, jMin, jMax] = [i0, i0, j0, j0]
      const stack: [number, number][] = [[i0, j0]]
      seen[i0][j0] = true
      while (stack.length > 0) {
        const [i, j] = stack.pop()!
        ;[iMin, iMax, jMin, jMax] = [Math.min(iMin, i), Math.max(iMax, i), Math.min(jMin, j), Math.max(jMax, j)]
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const [ni, nj] = [i + di, j + dj]
          if (outside[ni]?.[nj] && !seen[ni][nj]) {
            seen[ni][nj] = true
            stack.push([ni, nj])
          }
        }
      }
      notches.push({ width: xs[iMax + 1] - xs[iMin], depth: ys[jMax + 1] - ys[jMin] })
    }),
  )
  return notches
}

function insidePolygon(outline: Point[], x: number, y: number): boolean {
  let inside = false
  outline.forEach((a, i) => {
    const b = outline[(i + 1) % outline.length]
    if (a.y > y !== b.y > y && x < a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y)) inside = !inside
  })
  return inside
}
