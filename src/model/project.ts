// Plan model (docs/spec.md §4.3). This is also the save file format.
// Units: ft, kips, plf, psf. Shared by both tracks: announce changes in the commit message.

export type Axis = 'X' | 'Y'

/** Plan coordinates in ft. Origin at the Gridline 1 / Gridline A intersection; x to the right, y up. */
export interface Point {
  x: number
  y: number
}

export interface Project {
  version: 1
  name: string
  grid: Grid
  /** Bottom → top; the last one is the roof. */
  levels: Level[]
  loads: Loads
}

export interface Grid {
  /** ft between numbered Gridlines 1, 2, 3… (vertical lines), left → right. */
  xSpacings: number[]
  /** ft between lettered Gridlines A, B, C… (horizontal lines), bottom → top. */
  ySpacings: number[]
}

export interface Level {
  id: string
  /** "Level 2", "Roof" */
  name: string
  /** ft, height of the Story below this Level. */
  storyHeight: number
  /** Orthogonal polygon, counter-clockwise, first point not repeated. */
  outline: Point[]
  shearLines: ShearLine[]
  openings: Opening[]
  /** Story Force F_x and seismic weight, both psf of net area. */
  seismic: { fxPsf: number; weightPsf: number }
  underlay?: Underlay
}

/** A Shear Line's length is not stored: it is the Diaphragm cross-section at its position (spec §5.2). */
export interface ShearLine {
  id: string
  /** Gridline label if on one ("2", "B"), otherwise user text. */
  name: string
  /** The line is parallel to this axis and resists load in this direction. */
  direction: Axis
  /** ft: x for Y-lines, y for X-lines. */
  position: number
  lateralElements: LateralElement[]
}

export interface LateralElement {
  id: string
  /** Label only; it does not change the calcs. */
  kind: 'shearWall' | 'bracedFrame'
  /** ft along the line: y for Y-lines, x for X-lines; start < end. */
  start: number
  end: number
}

export interface Opening {
  id: string
  xMin: number
  yMin: number
  xMax: number
  yMax: number
}

export interface Underlay {
  /** PNG/JPG data URL; a PDF's page 1 is rendered to PNG on import. */
  dataUrl: string
  widthPx: number
  heightPx: number
  /** From the two-point calibration. */
  ftPerPx: number
  /** Plan position (ft) of the image's bottom-left corner. */
  x: number
  y: number
  /** 0–1 */
  opacity: number
}

export interface Loads {
  /** S_DS (g) */
  sds: number
  /** I_e */
  ie: number
  /** Strength level, applied to every Level. */
  windPlf: { X: number; Y: number }
  /** ρ, default 1.0 */
  rho: number
  /** Ω₀, default 3.0 */
  omega0: number
  /** Only used by the seismic code calc (phase A5). */
  seismicCode?: SeismicCodeInputs
}

export interface SeismicCodeInputs {
  latitude?: number
  longitude?: number
  riskCategory: 'I' | 'II' | 'III' | 'IV'
  /** USGS values: 'A' … 'E', 'D-default', 'DEFAULT', … */
  siteClass: string
  sd1: number
  s1: number
  /** T_L (s) */
  tl: number
  sdc?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  /** R */
  r: number
  /** Default 0.02 (T_a = C_t · h_n^x) */
  ct: number
  /** Default 0.75 */
  xExp: number
}
