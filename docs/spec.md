# Spec: Lateral Load Path App

> **Sources:** [problem.md](../problem.md) (decisions and scope), [GLOSSARY.md](../GLOSSARY.md) (terms),
> [ADR 0001](adr/0001-simple-beam-statics-not-tributary-area.md), and the
> [research notes](research/asce7-flexible-diaphragm-lateral-demands.md).
> **If they disagree:** problem.md wins, then this spec, then the research.
> **Tickets:** [docs/tickets/](tickets/README.md)
> Rules added while writing this spec (not covered in grilling) are listed in section 9. Challenge any of them that look wrong.

---

## 1. Problem

Structural engineers distribute lateral loads in flexible-diaphragm buildings by
hand or in one-off spreadsheets. Working out Diaphragm Reactions, Chord and
Collector forces, and story shears is tedious and hard to check, especially
when the plan changes or isn't a rectangle.

## 2. Solution

A browser app with an interactive plan view. The engineer builds each Level's
plan (on a grid, by drawing, or by tracing an imported drawing), places Shear
Lines, Lateral Elements, and Openings, and enters the loads. A pure calculation
engine recomputes every Demand along the load path on each change:

- Diaphragm Reactions, shear, unit shear, moment, F_px
- Chords and Re-entrant Corner drag forces
- Collectors along each Shear Line
- Lateral Element forces with story shear accumulated down the building
- Transfer Forces where a Shear Line stops, with their Collectors

Results are shown on the plan and in tables, for each Load Case and the
Envelope, at strength and ASD.

## 3. User stories

1. As an engineer, I want to type gridline spacings and get a grid, so I can build a plan the way drawings are laid out.
2. As an engineer, I want to make a rectangular outline from the grid extents in one click.
3. As an engineer, I want to draw an L- or T-shaped outline with orthogonal snapping, so I can model real plans.
4. As an engineer, I want the app to reject U, H, and C outlines with a clear message, so I know what's supported.
5. As an engineer, I want to click a gridline to add a Shear Line on it, named after the gridline.
6. As an engineer, I want to place Shear Lines anywhere in drawing mode and drag them, with results updating live.
7. As an engineer, I want to add one or more Lateral Elements on a Shear Line by dragging along it.
8. As an engineer, I want to draw rectangular Openings (stairs, shafts).
9. As an engineer, I want to add a Level that starts as a copy of the Level below, then edit it.
10. As an engineer, I want to enter F_x (psf), seismic weight (psf), and story height for each Level, and S_DS, I_e, wind plf in X and Y, ρ, and Ω₀ for the building.
11. As an engineer, I want to see the Diaphragm Reaction and story shear on each Shear Line.
12. As an engineer, I want to see F_px for each Level and which limit governs (equation, minimum, maximum, or F_x).
13. As an engineer, I want to see the shear, unit shear, and moment diagrams for each Diaphragm Span.
14. As an engineer, I want to see the Chord forces, including the drag force at Re-entrant Corners.
15. As an engineer, I want Openings to reduce the seismic load and the net depth used for unit shear.
16. As an engineer, I want to see the Collector force diagram along each Shear Line.
17. As an engineer, I want each Lateral Element's force and unit shear (plf), with the line's force split by length.
18. As an engineer, I want story shear to accumulate down Shear Lines that continue.
19. As an engineer, I want a Shear Line that stops to transfer its force into the Diaphragm below, and to see that transfer Collector's plf and force diagram.
20. As an engineer, I want to switch between Seismic X, Seismic Y, Wind X, Wind Y, and the Envelope.
21. As an engineer, I want strength and ASD values side by side.
22. As an engineer, I want to click an element and see its Demand × ρ (Lateral Elements) or × Ω₀ (Collectors).
23. As an engineer, I want to save my project to a JSON file and load it back, and not lose work on refresh.
24. As an engineer, I want to import a PNG, JPG, or PDF plan, scale it with two clicks, and trace over it.
25. As an engineer, I want to calculate F_x from ASCE 7-22 ELF, optionally with S_DS and S_D1 looked up from the site location.

---

## 4. Architecture

### 4.1 Stack, folders, ownership

React + TypeScript + Vite, plan view in SVG, Vitest for tests, `pdfjs-dist` for
PDF import. No backend.

```
src/
  model/            ← SHARED. Changing types here needs a quick check with each other
    project.ts        Plan model types (section 4.3)
    results.ts        Results types (section 4.4)
    ui.ts             Selection and app-state types
    defaults.ts       createDefaultProject() (= fixture T1), new ids
    geometry.ts       crossSection(outline, direction, position): [lo, hi] | null (used by both tracks)
    outline.ts        checkOutline(outline): { ok: true } | { ok: false; message } (section 5.13)
    fixtures/         T1–T7 test projects (section 7.2), plain TS objects
  engine/           ← Track A (Hamid). Pure functions, no React, no DOM
    analyze.ts        analyze(project): Results — the only entry point the UI calls
    sections.ts       cross-sections, depth, net depth, breakpoints
    beam.ts           simple-beam and cantilever statics with piecewise loads
    collectors.ts     collector force diagrams
    levels.ts         story shear, continuation, Transfer Forces
    envelope.ts
    seismicCode.ts    ELF calc + USGS lookup (A5)
    *.test.ts
  ui/
    plan/           ← Track B (Aidan). PlanView, tools, overlays
    panels/
      LoadForm.tsx    ← Track B
      LevelPanel.tsx  ← Track B
      ResultsPanel.tsx← Track A
      DetailPanel.tsx ← Track A
      Warnings.tsx    ← Track A
    io/             ← Track B. saveLoad.ts, underlay.ts
  App.tsx           ← SHARED skeleton (layout + state), created in P0
demo/
  demo-project.json ← prepared in demo prep
```

### 4.2 App state and data flow

`App.tsx` holds all state; there is no state library.

```ts
const [project, setProject] = useState<Project>(loadAutosave() ?? createDefaultProject());
const [levelId, setLevelId] = useState<string>(...);              // Level shown on the plan
const [caseId, setCaseId] = useState<LoadCaseId | 'ENV'>('SY');
const [selection, setSelection] = useState<Selection>(null);
const [showAsd, setShowAsd] = useState(false);                      // Strength/ASD toggle for plan labels
const results = useMemo(() => analyze(project), [project]);
```

- Every edit creates a new `project` object (immutable updates). `analyze` reruns on each change. It must stay fast: under 50 ms for the demo project.
- Track B components receive `project`, `setProject`, `levelId`, `caseId`, `results`, and `selection`/`setSelection`.
- Track A panels receive `project`, `results`, `levelId`, `caseId`, and `selection`/`setSelection`.

### 4.3 Plan model: `src/model/project.ts`

This is also the save file format. Units: ft, kips, plf, psf.

```ts
export type Axis = 'X' | 'Y';

/** Plan coordinates in ft. Origin at the Gridline 1 / Gridline A intersection; x to the right, y up. */
export interface Point { x: number; y: number }

export interface Project {
  version: 1;
  name: string;
  grid: Grid;
  levels: Level[];          // bottom → top; the last one is the roof
  loads: Loads;
}

export interface Grid {
  xSpacings: number[];      // ft between numbered Gridlines 1, 2, 3… (vertical lines), left → right
  ySpacings: number[];      // ft between lettered Gridlines A, B, C… (horizontal lines), bottom → top
}

export interface Level {
  id: string;
  name: string;             // "Level 2", "Roof"
  storyHeight: number;      // ft, height of the Story below this Level
  outline: Point[];         // orthogonal polygon, counter-clockwise, first point not repeated
  shearLines: ShearLine[];
  openings: Opening[];
  seismic: { fxPsf: number; weightPsf: number };   // Story Force F_x and seismic weight, both psf of net area
  underlay?: Underlay;
}

export interface ShearLine {
  id: string;
  name: string;             // Gridline label if on one ("2", "B"), otherwise user text
  direction: Axis;          // the line is parallel to this axis and resists load in this direction
  position: number;         // ft: x for Y-lines, y for X-lines
  lateralElements: LateralElement[];
}
// A Shear Line's length is not stored. It is the Diaphragm cross-section at its position (section 5.2).

export interface LateralElement {
  id: string;
  kind: 'shearWall' | 'bracedFrame';   // label only; it does not change the calcs
  start: number;            // ft along the line: y for Y-lines, x for X-lines; start < end
  end: number;
}

export interface Opening { id: string; xMin: number; yMin: number; xMax: number; yMax: number }

export interface Underlay {
  dataUrl: string;          // PNG/JPG data URL; a PDF's page 1 is rendered to PNG on import
  widthPx: number;
  heightPx: number;
  ftPerPx: number;          // from the two-point calibration
  x: number;                // plan position (ft) of the image's bottom-left corner
  y: number;
  opacity: number;          // 0–1
}

export interface Loads {
  sds: number;              // S_DS (g)
  ie: number;               // I_e
  windPlf: { X: number; Y: number };   // strength level, applied to every Level
  rho: number;              // ρ, default 1.0
  omega0: number;           // Ω₀, default 3.0
  seismicCode?: SeismicCodeInputs;      // only used by the code calc (phase A5)
}

export interface SeismicCodeInputs {
  latitude?: number;
  longitude?: number;
  riskCategory: 'I' | 'II' | 'III' | 'IV';
  siteClass: string;        // USGS values: 'A' … 'E', 'D-default', 'DEFAULT', …
  sd1: number;
  s1: number;
  tl: number;               // T_L (s)
  sdc?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  r: number;                // R
  ct: number;               // default 0.02
  xExp: number;             // default 0.75  (T_a = C_t · h_n^x)
}
```

`src/model/ui.ts`:

```ts
export type Selection =
  | { kind: 'shearLine'; levelId: string; id: string }        // shows the line and its Collector
  | { kind: 'lateralElement'; levelId: string; lineId: string; id: string }
  | { kind: 'opening'; levelId: string; id: string }
  | { kind: 'transfer'; levelId: string; fromLineId: string } // levelId = the Level that receives it
  | null;
```

### 4.4 Results: `src/model/results.ts`

All values are **strength level**, without ρ or Ω₀. The UI multiplies by
`asdFactor` for ASD columns.

```ts
export type LoadCaseId = 'SX' | 'SY' | 'WX' | 'WY';

export interface Results {
  cases: Record<LoadCaseId, CaseResult>;
  envelope: EnvelopeEntry[];
  warnings: Warning[];
}

export interface CaseResult {
  caseId: LoadCaseId;
  direction: Axis;          // load direction
  asdFactor: number;        // 0.7 seismic, 0.6 wind
  levels: LevelResult[];    // same order as project.levels
}

export interface LevelResult {
  levelId: string;
  netArea: number;          // sf, outline minus Openings
  fx: number;               // kips: Story Force (seismic) or total wind on the Level
  weight: number;           // kips: seismic weight (0 for wind)
  fpx?: FpxResult;          // seismic only
  spans: SpanResult[];      // Diaphragm Spans and Overhangs, ordered along the span axis
  lines: LineResult[];      // Shear Lines in the load direction only
  corners: CornerResult[];
  transfersIn: TransferResult[];   // Transfer Forces applied to this Level's Diaphragm
}

export interface FpxResult {
  raw: number;              // (ΣF_i / Σw_i) · w_px
  min: number;              // 0.2 · S_DS · I_e · w_px
  max: number;              // 0.4 · S_DS · I_e · w_px
  fpx: number;              // raw clamped to [min, max]
  design: number;           // max(fx, fpx): what the Diaphragm, Chords, and Collectors use
  governs: 'equation' | 'min' | 'max' | 'fx';
}

/** Values at stations s (ft) along a span axis or a line axis. */
export interface Diagram { s: number[]; v: number[] }

export interface SpanResult {
  kind: 'span' | 'overhang';
  fromLineId: string | null;   // null at the free end of an Overhang
  toLineId: string | null;
  start: number;               // ft along the span axis
  end: number;
  shear: Diagram;              // kips      (F_px design level)
  moment: Diagram;             // kip-ft    (F_px design level)
  unitShear: Diagram;          // plf       = |V| / net depth
  chord: Diagram;              // kips      = |M| / gross depth
  maxShear: number;
  maxUnitShear: number;
  maxMoment: number;
  maxChord: number;
}

export interface LineResult {
  lineId: string;
  length: number;              // ft, Diaphragm cross-section at the line
  reactionFx: number;          // kips, Diaphragm Reaction at F_x level (includes Transfer Forces into this Level)
  reactionFpx: number;         // kips, at F_px design level
  storyShear: number;          // kips, carried by this line's Lateral Elements (Story below this Level)
  unitShearLeft: number;       // plf, Diaphragm unit shear on the lower-s side (F_px level)
  unitShearRight: number;      // plf, on the higher-s side
  elements: { elementId: string; force: number; unitShear: number }[];  // kips, plf
  collector: { force: Diagram; maxForce: number };                      // kips along the line axis (F_px level)
  continuesBelow: boolean;     // false → its story shear becomes a Transfer Force
}

export interface CornerResult {
  s: number;                   // ft along the span axis
  point: Point;                // the inside corner vertex
  force: number;               // kips, M / narrower gross depth (F_px level)
}

export interface TransferResult {
  fromLevelId: string;         // Level of the Shear Line that stops
  fromLineId: string;
  position: number;            // ft along the span axis
  force: number;               // kips (the stopped line's story shear)
  collectorPlf: number;        // force / net depth at that position × 1000
  collector: { force: Diagram; maxForce: number };
}

export interface EnvelopeEntry {
  levelId: string;
  kind: 'lateralElement' | 'line' | 'collector' | 'transferCollector' | 'span';
  refId: string;               // element id, line id, line id, "fromLevelId:fromLineId", or "lineIdFrom→lineIdTo"
  quantity: 'force' | 'storyShear' | 'unitShear' | 'chord' | 'collectorForce';
  strength: { value: number; caseId: LoadCaseId };
  asd: { value: number; caseId: LoadCaseId };
}

export interface Warning {
  severity: 'error' | 'warning';
  code:
    | 'outline-invalid'          // not orthogonal, self-intersecting, or a cut passes through two pieces
    | 'too-few-lines'            // fewer than 2 Shear Lines in a direction on a Level
    | 'line-without-elements'    // a Shear Line with a nonzero reaction but no Lateral Elements
    | 'element-off-line'         // part of a Lateral Element is outside the line's length (it is clipped)
    | 'opening-chords'           // chord forces around Openings are not calculated
    | 'overhang-long'            // Overhang longer than 6 ft
    | 'transfer-outside'         // a stopped Shear Line lands outside the Diaphragm below
    | 'reentrant-irregularity';  // §12.3.3.4 +25% applied to Collectors (A5 only)
  levelId?: string;
  refId?: string;
  message: string;
}
```

---

## 5. Calculation rules (engine)

Units in the engine: ft, kips, kip-ft. Convert psf and plf to kips at the
boundary (`/1000`). Report plf as kips/ft × 1000.

### 5.1 Directions and the span axis

| Load Case | Load direction | Shear Lines used | Span axis s | Depth measured along | Line axis t |
|-----------|----------------|------------------|-------------|----------------------|-------------|
| SX, WX | X | `direction === 'X'` (at y = position) | y | x | x |
| SY, WY | Y | `direction === 'Y'` (at x = position) | x | y | y |

### 5.2 Cross-sections, depth, breakpoints

- **Cross-section at s:** the intersection of the outline with the line perpendicular to the span axis at s. Because of the shape rule (section 5.13), it is one interval [lo, hi].
- **Gross depth** d(s) = hi − lo.
- **Net depth** dₙ(s) = d(s) minus the widths of Openings crossing that cut.
- **At a breakpoint** (outline edge or Opening edge exactly at s), there are two values, one from each side.
  - Shear Line length uses the larger.
  - Diagrams record both, as two stations at the same s.
- **Breakpoints** are where d or dₙ changes: outline vertex coordinates and Opening edges along s, plus Shear Line positions and Transfer Force positions. Between breakpoints, loads are uniform, so all integrals are exact.
- **Shear Line length** = the cross-section at the line's position (larger side at a step).

### 5.3 Loads on a Level for one Load Case

- **Seismic, F_x level:** w(s) = q_x · dₙ(s), where q_x = fxPsf / 1000 (ksf).
  - F_x = q_x · netArea
  - weight w_x = weightPsf · netArea / 1000
- **Seismic, F_px level:** w(s) = q_px · dₙ(s), where q_px = F_px.design / netArea.
- **Wind:** w(s) = windPlf[direction] / 1000 wherever d(s) > 0. The F_x and F_px runs are the same, and `fpx` is undefined.
- **Transfer Forces** from the Level above are added as point loads P at their position, in **both** runs (section 5.10).

### 5.4 F_px (seismic only)

For Level x, with Levels i ≥ x being x and every Level above it:

```
raw    = (Σ F_i / Σ w_i) · w_x          (w_px = w_x; parallel walls are not excluded)
min    = 0.2 · S_DS · I_e · w_x
max    = 0.4 · S_DS · I_e · w_x
fpx    = clamp(raw, min, max)
design = max(F_x, fpx)
```

`governs` is `'equation'`, `'min'`, `'max'`, or `'fx'` (if F_x > fpx).

### 5.5 Diaphragm Spans and Overhangs (simple beams)

Per [ADR 0001](adr/0001-simple-beam-statics-not-tributary-area.md):

- Sort the Shear Lines in the load direction by position: p₁ < p₂ < … < p_m. You need m ≥ 2, otherwise raise `too-few-lines` and produce no spans or lines for that direction.
- **Diaphragm Span j** runs from p_j to p_{j+1}. It is a **simple beam** under its piecewise-uniform w(s) and any point loads.
  - R_right = Σ(load × distance from p_j) / L
  - R_left = total − R_right
  - V(s) = R_left − ∫w − ΣP (for points left of s)
  - M(s) = ∫V
- **Overhang:** any Diaphragm beyond p₁ or beyond p_m is a **cantilever** from that line. All of its load goes to that line. V and M are zero at the free end. It does not change the adjacent span. Raise `overhang-long` if it is longer than 6 ft.
- **Diagrams:**
  - Values are exact at every breakpoint and at each zero-shear point (the maximum moment inside a piece).
  - Where depth or load jumps, both the left and right values are recorded. In T3, the chord is 3.375 k just left of s = 30 and 6.75 k just right of it.
  - Stations for drawing are at most every 1 ft.
  - The max values come from the exact points.

### 5.6 Diaphragm Reactions, unit shear, Chords

- **Diaphragm Reaction** of a line = the sum of the span or Overhang end reactions on each side.
  - From the F_x run → `reactionFx`
  - From the F_px run → `reactionFpx`
- **Unit shear:** v(s) = |V(s)| / dₙ(s) × 1000 plf, using the F_px run.
  - `unitShearLeft` / `unitShearRight` = the end shear of the span on that side ÷ net depth at the line.
- **Chord:** T = C = |M(s)| / d(s), using **gross** depth and the F_px run. Chords never get Ω₀.
- **Openings:** raise `opening-chords` (warning) for each Level that has Openings.

### 5.7 Re-entrant Corners

At every breakpoint *inside* a span where the gross depth changes (more than 0.01 ft from a Shear Line):

- force = |M(s)| / min(d_left, d_right)
- One `CornerResult` per inside vertex at that s.
- **No marker on the plan.** Corners are listed in the results table only.

### 5.8 Lateral Elements and story shear

Process Levels **top to bottom**:

- `storyShear(line L at Level i)` = `reactionFx(L, i)` + Σ `storyShear(L′, i+1)` for every line L′ at Level i+1 that **continues** into L.
  - L′ continues into L when they have the same direction and |position difference| ≤ 0.5 ft.
- **Lines at the bottom Level** always continue (to the foundation).
- **Splitting the story shear** among the line's Lateral Elements, **by length** after clipping to the line's length:
  - force_e = storyShear · L_e / ΣL
  - unitShear = storyShear / ΣL × 1000
- **Problems:**
  - Raise `element-off-line` when an element is clipped.
  - Raise `line-without-elements` if ΣL = 0 and storyShear > 0.

### 5.9 Collectors (along each Shear Line, F_px run)

On the line axis t over the line's length [lo, hi]:

- v_in(t) = reactionFpx / (net length of line inside the Diaphragm). It is zero where an Opening crosses the line.
- v_out(t) = reactionFpx / ΣL_e on Lateral Element segments, zero elsewhere.
- F(t) = ∫_lo^t (v_in − v_out) dt. Check: F(hi) ≈ 0.
- Stations at segment ends, with at most 1 ft between them. `maxForce` = max |F|.

### 5.10 Transfer Forces

When a line L at Level i (i > 0) does **not** continue into Level i−1:

- **P** = storyShear(L, i), at F_x level. It is applied as a point load at s = position(L) to Level i−1, in both the F_x and F_px runs. It goes into that Level's reactions, shear, moment, and Chords.
- **Outside the Diaphragm below:** if position(L) is outside the Diaphragm of Level i−1 along s, raise `transfer-outside` (error) and skip it.
- **Transfer Collector** at Level i−1 along t over the cross-section at position(L):
  - v_in = P / ΣL_e on the stopped line's Lateral Element segments (clipped)
  - v_out = P / net length, uniform
  - F(t) = ∫(v_in − v_out)
  - collectorPlf = P / net length × 1000

### 5.11 Load Cases, ASD, Envelope

- **Load Cases:**
  - SX and SY use the seismic inputs.
  - WX and WY use `windPlf.X` and `windPlf.Y`.
  - A wind value of 0 gives all-zero results.
- **asdFactor:** 0.7 for SX/SY, 0.6 for WX/WY.
- **Envelope:** for each element and quantity, the max |value| across the four cases, found **separately** for strength and for ASD. The governing case can differ between them.
  - **Entries:** Lateral Element force; line storyShear; Collector maxForce; transfer Collector maxForce; span maxUnitShear and maxChord.

### 5.12 ρ and Ω₀

These never go into `Results` or the tables. The Detail panel shows them:

- **Lateral Element:** E, ρ·E, 0.7·ρ·E (seismic) or E, 0.6·E (wind, no ρ).
- **Collector** (line or transfer): E, Ω₀·E, 0.7·Ω₀·E (seismic) or wind as-is.
- Values are shown for the current Load Case and for the Envelope.

### 5.13 Validation

- **Outline** (`outline-invalid`, error; the Level gets no results):
  - at least 4 vertices
  - every edge horizontal or vertical
  - not self-intersecting
  - every horizontal and vertical cut through the interior is a single interval
- **Shear Lines:** checked per direction (`too-few-lines`).
- **Openings** must be inside the outline, or they are clipped.

### 5.14 Seismic code calc (phase A5)

Uses research section 3, formulas B1–B6:

- **Weights:** h_n = Σ storyHeight; h_x = elevation of Level x; w_x = weightPsf · netArea / 1000; W = Σ w_x.
- **Period:** T = T_a = C_t · h_n^x.
- **C_s:**
  - C_s = S_DS·I_e / R
  - capped at S_D1·I_e / (T·R) if T ≤ T_L, or at S_D1·T_L·I_e / (T²·R) if T > T_L
  - at least max(0.044·S_DS·I_e, 0.01)
  - and at least 0.5·S1·I_e / R if S1 ≥ 0.6
- **Base shear:** V = C_s · W.
- **Vertical distribution:** F_x = V · w_x·h_x^k / Σ w_i·h_i^k.
  - k = 1 for T ≤ 0.5 s, 2 for T ≥ 2.5 s, linear in between.
- **Writes back** fxPsf = F_x · 1000 / netArea into each Level. The user sees the inputs change, labeled "calculated".
- **USGS lookup:**
  - Request: `GET https://earthquake.usgs.gov/ws/building-codes/asce7-22/calculate?latitude=…&longitude=…&riskCategory=…&siteClass=…&title=app`
  - Read `response.data.{sds, sd1, s1, sdc, tl}` into `loads.sds` and `loads.seismicCode`.
  - Use a 10 s timeout and show any error. Manual entry always works.
- **§12.3.3.4:** applies if `sdc` is D, E, or F and a Level's outline has a notch (bounding box minus outline) wider than 0.15 × the plan width **and** deeper than 0.15 × the plan depth.
  - Then multiply that Level's Collector and transfer Collector Demands by 1.25 for SX and SY.
  - Raise `reentrant-irregularity` (warning).

---

## 6. UI

### 6.1 Layout

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Mode [Grid|Draw|Import]  Tool [Select|Outline|Shear Line|Element|Opening|Delete] │
│ Level [Roof ▾] [+ Level]   Case [SX|SY|WX|WY|ENV]   Strength/ASD   [Save][Load] │  ← Track B
├──────────────────────────────────────────────────────┬────────────────────────┤
│                                                      │ [Loads][Results][Detail][Code calc]
│                  Plan view (SVG)                     │  Loads     ← Track B    │
│                  Track B                             │  Results   ← Track A    │
│                                                      │  Detail    ← Track A    │
│                                                      │  Code calc ← Track A    │
├──────────────────────────────────────────────────────┴────────────────────────┤
│ Warnings bar (from results.warnings, current Level)                ← Track A  │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Plan view

- **Coordinates:** SVG with a y-flip transform, so the model stays y-up. Mouse wheel zooms; dragging the background pans.
- **Snapping:**
  - Grid mode: snap to Gridline intersections and Gridlines.
  - Draw mode: snap to 1 ft and to existing vertices.
- **Drawn layers, bottom to top:**
  1. Underlay
  2. Gridlines with bubbles
  3. Outline fill
  4. Openings (hatched)
  5. Shear Lines (dashed)
  6. Lateral Elements (thick)
  7. Results overlay
  8. Selection highlight
- **Tools:**
  - **Select:** click to select. Drag a Shear Line perpendicular to itself to move it; results update live.
  - **Outline:** click vertices with orthogonal constraint; click the first point to close. Invalid shapes show the `outline-invalid` message.
  - **Shear Line:**
    - Grid mode: click a Gridline, and the line gets the Gridline's name and position.
    - Draw mode: click a point and pick X or Y with a toggle (default from the drag direction).
  - **Element:** drag along a Shear Line to add a Lateral Element.
  - **Opening:** drag a rectangle.
  - **Delete:** click an item to remove it.

### 6.3 Results on the plan (current Level and Load Case)

- **Shear Lines:**
  - label with Diaphragm Reaction (F_x) and story shear
  - "↓ transfer" tag if the line doesn't continue below
- **Lateral Elements:** label with force and plf. Color shows plf relative to the highest on the Level.
- **Collector diagram** along each line, drawn as a filled offset polygon, with the max labeled.
- **Diaphragm diagrams:** shear and moment drawn along the span axis outside the outline, plus the max Chord force labeled on both Chord edges of each span.
- **Transfer Collectors:** dashed, labeled with plf and max force.
- **Strength/ASD toggle:** switches all labels, using asdFactor.
- **ENV:** labels show Envelope values with the governing case.

### 6.4 Load form and Levels (Track B)

- **Building inputs:** S_DS, I_e, wind X (plf), wind Y (plf), ρ, Ω₀.
- **Current Level:** name, story height, F_x (psf), seismic weight (psf).
- **"+ Level"** adds a Level on top as a deep copy of the top Level (new ids), named "Level n", and selects it.
- **Delete Level:** allowed if more than one Level exists.

### 6.5 Results panel and Detail panel (Track A)

- **Results panel:** tables for the current Level and Load Case, with strength and ASD columns:
  1. Level forces: F_x, weight, F_px (raw/min/max/design/governs)
  2. Shear Lines: length, reactionFx, reactionFpx, story shear, unit shear left/right, continues?
  3. Lateral Elements: force and plf
  4. Diaphragm Spans: L, max V, max v, max M, max Chord
  5. Collectors: max force
  6. Re-entrant Corners
  7. Transfers

  Clicking a row sets `selection`. With ENV selected, it shows the Envelope table.
- **Detail panel:** the selected item's values in every Load Case plus the Envelope, with ρ or Ω₀ applied per section 5.12.

### 6.6 Save, load, autosave (Track B)

- **Save:** download `<project.name>.lateral.json` (pretty-printed `Project`).
- **Load:** file picker. Check `version === 1` and the basic shape; on failure, show an error and keep the current project.
- **Autosave:** to `localStorage['hackathon2026.project']`, debounced 500 ms.
  - On startup, use the autosave if it's present, otherwise `createDefaultProject()`.
  - If storage is full, autosave without Underlays and show a one-time notice.
- **New project:** a button that resets to the default after confirming.

### 6.7 Import (Track B)

- **PNG/JPG:** read as a data URL.
- **PDF:** render page 1 with `pdfjs-dist` at 2× scale to a PNG data URL.
- **Calibrate:**
  1. The user clicks two points on the image and types the real distance (ft) → `ftPerPx`.
  2. The Underlay is placed with its bottom-left at (0, 0).
  3. In Select mode, drag the Underlay to align it.
  4. Opacity slider; "Lock" toggle.
- **One Underlay per Level.** "+ Level" copies it.

---

## 7. Testing

### 7.1 Strategy

- **Engine:** tested **only through `analyze(project)`** (plus `seismicCode` functions), using the fixtures below. Tests check public results, not internals, so the engine can be refactored freely.
- **Model helpers** (outline check, defaults) get small unit tests.
- **UI:** not unit-tested. Each Track B ticket has a short manual check.
- **Save/load:** round-trip test (`JSON.parse(JSON.stringify(p))` loads to an equal project).
- **Tolerance:** compare numbers to 3 significant decimals (`toBeCloseTo(x, 2)` for kips, `toBeCloseTo(x, 1)` for plf).

### 7.2 Fixtures and expected values (strength level, SY unless noted)

**T1 — single story, rectangle** (also `createDefaultProject()`)

- **Plan:** outline 100 × 50 ft, (0,0) (100,0) (100,50) (0,50).
- **Y-lines:**
  - "1" at x = 0 with an element [0, 50]
  - "2" at x = 40 with an element [0, 20]
  - "3" at x = 100 with an element [0, 50]
- **X-lines:** "A" at y = 0 and "B" at y = 50, each with an element [0, 100].
- **Inputs:** fxPsf 5.2, weightPsf 24, storyHeight 16, S_DS 1.30, I_e 1.0, wind X/Y 0, ρ 1.0, Ω₀ 3.0.

| Quantity | Expected |
|---|---|
| netArea, F_x, weight | 5000 sf, 26.0 k, 120.0 k |
| F_px raw / min / max / design / governs | 26.0 / 31.2 / 62.4 / 31.2 / `min` |
| reactionFx lines 1, 2, 3 | 5.2, 13.0, 7.8 |
| reactionFpx lines 1, 2, 3 | 6.24, 15.6, 9.36 |
| Span 1→2: maxShear, maxUnitShear, maxMoment, maxChord | 6.24 k, 124.8 plf, 62.4 k-ft, 1.248 k |
| Span 2→3 | 9.36 k, 187.2 plf, 140.4 k-ft, 2.808 k |
| Line 2 Collector maxForce (element [0, 20]) | 9.36 k |
| Line 2 element: force, unitShear | 13.0 k, 650 plf |
| Line 1 element; line 3 element | 5.2 k, 104 plf; 7.8 k, 156 plf |
| ASD span 2→3 maxChord | 1.966 k |

- **T1b** (line 2 element moved to [15, 35]): Collector maxForce = **4.68 k**.
- **T1w** (windPlf.Y = 300):
  - WY reactionFx: 6.0, 15.0, 9.0.
  - Envelope for line 2's element:
    - strength: **15.0 k, WY**
    - ASD: **9.1 k, SY** (0.7 × 13.0 beats 0.6 × 15.0)

**T2 — two stories, stacked**

- **Levels:** same plan and lines as T1 on both Levels.
  - Level 2: storyHeight 10, fxPsf 6.0, weightPsf 40.
  - Roof: storyHeight 10, fxPsf 6.0, weightPsf 20.
- **Inputs:** S_DS 1.30, I_e 1.0.

| Quantity | Roof | Level 2 |
|---|---|---|
| F_x, weight | 30.0, 100.0 | 30.0, 200.0 |
| F_px raw / min / max / design / governs | 30 / 26 / 52 / 30 / `equation` | 40 / 52 / 104 / 52 / `min` |
| storyShear lines 1, 2, 3 | 6, 15, 9 | **12, 30, 18** |
| Span 1→2: max V, v, M, Chord | 6.0, 120, 60, 1.20 | 10.4, 208, 104, 2.08 |
| Span 2→3 | 9.0, 180, 135, 2.70 | 15.6, 312, 234, **4.68** |

**T3 — L-shape** (the ADR 0001 example)

- **Outline:** (0,0) (60,0) (60,25) (30,25) (30,50) (0,50).
- **Y-lines:** at x = 0 with an element [0, 50]; at x = 60 with an element [0, 25].
- **X-lines:** at y = 0 with [0, 60]; at y = 50 with [0, 30].
- **Inputs:** fxPsf 10, weightPsf 50, S_DS 0.6, I_e 1.0, so F_px.design = F_x = 22.5 k (`equation`).

| Quantity | Expected |
|---|---|
| netArea, F_x | 2250 sf, 22.5 k |
| reactionFx at x = 0, x = 60 | **13.125, 9.375** (tributary area would give 15.0 / 7.5) |
| line lengths | 50, 25 |
| Span maxMoment (at s = 26.25) | 172.27 k-ft |
| Span maxChord (at s = 30, narrow side) | 6.75 k |
| Corner at s = 30, point (30, 25), force | 6.75 k |
| unitShearLeft at x = 60 | 375 plf |
| maxUnitShear | 375 plf |

**T4 — Opening**

- **Plan:** 100 × 50 rectangle.
- **Y-lines:** at x = 0 and x = 100, both full length.
- **X-lines:** A and B, both full length.
- **Opening:** x 10–20, y 20–30.
- **Inputs:** fxPsf 10, weightPsf 50, S_DS 0.6, so F_px.design = F_x = 49.0 k.

| Quantity | Expected |
|---|---|
| netArea, F_x | 4900 sf, 49.0 k |
| reactionFx at x = 0, x = 100 | 24.15, 24.85 |
| V at s = 15 | 17.15 k |
| unitShear at s = 15 (net depth 40) | 428.75 plf |
| chord at s = 15 (gross depth 50) | 6.145 k |
| Warnings | includes `opening-chords` |

**T5 — Transfer Force**

- **Setup:** T2, except Level 2 has **no** line at x = 40. Its Y-lines are only at x = 0 and x = 100.
- **What happens:** the Roof's line 2 (element [0, 20]) stops, so it transfers 15.0 k into Level 2 at x = 40.

| Quantity | Expected |
|---|---|
| Roof line 2 continuesBelow | false |
| Level 2 transfersIn | 1 transfer, position 40, force 15.0 k, collectorPlf 300, collector maxForce 9.0 k |
| Level 2 reactionFx at x = 0, x = 100 | 24.0, 21.0 |
| Level 2 storyShear at x = 0, x = 100 | **30.0, 30.0** |
| Level 2 reactionFpx at x = 0, x = 100 | 35.0, 32.0 |
| Level 2 span maxMoment, maxChord (at s = 40) | 984 k-ft, 19.68 k |

**T6 — validation**

- U outline (0,0) (60,0) (60,50) (40,50) (40,20) (20,20) (20,50) (0,50) → `outline-invalid`.
- T1 with only line "1" in Y → `too-few-lines`, and SY has no spans.

**T7 — Overhang**

- **Plan:** 100 × 50 rectangle.
- **Y-lines:** at x = 0 and x = 90, both full length.
- **Inputs:** fxPsf 10, weightPsf 50, S_DS 0.6.

| Quantity | Expected |
|---|---|
| reactionFx at x = 0, x = 90 | 22.5, 27.5 |
| Overhang maxMoment, maxChord | 25.0 k-ft, 0.5 k |
| Warnings | includes `overhang-long` |

**Code calc (A5)**

- **T2 inputs + seismicCode** {sd1 0.65, s1 0.55, tl 8, r 6.5, ct 0.02, xExp 0.75}:
  - T = 0.189 s, C_s = 0.200, V = 60.0 k, k = 1
  - F_x = 30.0 k at each Level, so fxPsf = 6.0 at both
- **T1 with weightPsf 24 and h_n 16:**
  - T = 0.160 s, V = 24.0 k, fxPsf = 4.8
- **USGS:** mock `fetch` with a response where `data` = {sds 1.27, sd1 1.13, s1 0.66, sdc 'D', tl 8}. The fields should fill in.

---

## 8. Out of scope

See [problem.md section 7](../problem.md#7-scope).

## 9. Rules added while writing this spec (not covered in grilling)

Challenge any of these that look wrong:

1. **Grid origin:** Gridline A is at the bottom (y = 0) and Gridline 1 is at the left (x = 0).
2. **Level order:** Levels are stored bottom → top. `storyHeight` is the Story *below* the Level. "+ Level" adds on top as a copy of the top Level.
3. **Shear Line length:** not stored. It is the Diaphragm cross-section at the line's position, taking the larger side at a depth step.
4. **Overhangs** beyond the outermost Shear Line are cantilevers to that line, with a warning above 6 ft (research: SDPWS §4.2.6).
5. **At least 2 Shear Lines per direction** on each Level. Otherwise that direction gets no results (error).
6. **Diaphragm design force** = max(F_x, F_px), per the research (FEMA P-2192).
7. **Depths:** Chords use **gross** depth; unit shear and Collectors use **net** depth.
8. **Transfer Force size:** the stopped line's story shear at F_x level, added to both the F_x and F_px runs of the Level below.
9. **Wind:** no F_px for wind. The plf is applied wherever the Level has Diaphragm along the span axis.
10. **Default factors:** Ω₀ = 3.0 (light-frame wood, from the research example), ρ = 1.0.
11. **Envelope:** found separately for strength and ASD, because the governing case can differ (see T1w).
12. **Element kind:** shear wall vs. braced frame is a label only and doesn't change the calcs.
13. **Default project:** `createDefaultProject()` returns T1, so the app shows results immediately.
14. **Autosave:** drops Underlays if browser storage is full.
15. **New Shear Lines** get one Lateral Element over their full length by default, so results appear right away. The user edits or deletes it.
16. **Code calc UI:** the seismic code calc gets its own "Code calc" tab (Track A), so it doesn't touch Track B's Load form.
