# Problem — Hackathon 2026

> **Status:** READY TO BUILD. Spec and tickets are written; start with ticket P0.1.
> Items marked _(assumed)_ were not covered in grilling.
> **Time box:** 11:00 AM – 4:00 PM (5 hours). Everything below has to fit in that.
> **Team:** Hamid (Track A: calc engine + results), Aidan (Track B: plan editor)

## How to use this file

This file is where the team agrees on what we're building. Pipeline:

1. ~~**Research**~~: done, see [the research notes](docs/research/asce7-flexible-diaphragm-lateral-demands.md).
2. ~~**Grill**~~: done. The answers are in section 8; vocabulary is in [GLOSSARY.md](GLOSSARY.md).
3. ~~**Spec**~~: done, see [docs/spec.md](docs/spec.md).
4. ~~**Tickets**~~: done, see [docs/tickets/](docs/tickets/README.md).
5. **Implement**: build one vertical-slice phase at a time (see *Build phases* in section 5). Every phase ends with an app we can demo.

**Rules:**
- If scope changes, update this file first.
- Use the terms in [GLOSSARY.md](GLOSSARY.md) in code, UI labels, and conversation.

---

## 1. Subject

An interactive plan-view app for distributing lateral loads in buildings with
**flexible diaphragms**. The user creates a floor plan for each Level (on a
grid, by drawing it, or by tracing an imported image or PDF), places Shear
Lines and Lateral Elements, and enters the loads. The app calculates the
Demands along the **whole lateral load path**:

- **Diaphragm:** reactions, shear, unit shear (plf), and moment for each Diaphragm Span
- **Chords:** tension and compression forces (M/d), including the drag force at Re-entrant Corners
- **Collectors:** force diagrams along each Shear Line, plus Collectors that spread Transfer Forces into the Diaphragm below
- **Lateral Elements:** force and unit shear (plf) for each element, with story shear accumulated down the building

### User flow

1. **Create the plan.** Pick a geometry input mode (below) and build the outline for a Level.
2. **Place Shear Lines and Lateral Elements.** Orthogonal lines; one or more walls or frames on each line.
3. **Add Openings.** Rectangular stairs and shafts.
4. **Add Levels.** "Add level" copies the Level below, then the user edits it.
5. **Enter the loads.** Seismic and wind inputs (below).
6. **See the Demands.** On the plan and in tables, for each Load Case and the Envelope, at strength and ASD.
7. **Inspect an element.** Click a Lateral Element or Collector to see its Demand with ρ or Ω₀ applied.
8. **Save / load** the project as a JSON file.

### Geometry input modes

All three modes produce the same plan model, so the calculations don't care
which one was used.

| Mode | User does | App does |
|------|-----------|----------|
| **Grid** | Types spacings as lists (e.g. `20, 20, 30, 30`). Numbered Gridlines (1, 2, 3…) run vertically, lettered Gridlines (A, B, C…) run horizontally. Clicks Gridlines to add Shear Lines | Snaps the outline and Shear Lines to the Gridlines |
| **Drawing** | Draws an orthogonal outline (rectangle, L, T, +) and Shear Lines | Snaps points, keeps lines orthogonal, checks the shape is allowed |
| **Import** | Uploads a PNG/JPG or a PDF (first page), clicks two points and types the distance between them | Shows a scaled Underlay for the Level that the user traces over |

### Load inputs

| Input | Where it's entered | Notes |
|-------|--------------------|-------|
| **Story Force F_x** (psf) | Each Level | Strength level, C_s already applied. Used for Shear Lines and Lateral Elements |
| **Seismic weight w** (psf) | Each Level | Dead load. Needed to calculate F_px |
| **S_DS, I_e** | Whole building | Needed for the F_px bounds |
| **Wind** (plf) | One value per direction | Strength level. Applied as-is to every Level's Diaphragm |
| **ρ, Ω₀** | Whole building | Only used in the element detail panel |

## 2. Problem statement

_(assumed)_ Distributing lateral loads to Shear Lines in flexible-diaphragm
buildings is usually done by hand or in one-off spreadsheets. Working out
reactions, chord and collector forces, and story shears is tedious, easy to get
wrong, and hard to check visually, especially when the plan or wall layout
changes.

## 3. Users

_(assumed)_ Structural engineers, especially for early-stage and schematic
lateral design of buildings with flexible diaphragms (e.g. wood or untopped
metal deck).

## 4. Why it matters

_(assumed)_ Fast, visual, repeatable lateral load distribution. When the layout
changes, the Demands update right away, so there's no spreadsheet to rework.

## 5. What "done" looks like (the demo)

The demo runs locally on one laptop (`npm run dev`) and starts by loading a
prepared project file: a **2-story L-shaped building with an Opening and a
Shear Line that stops at Level 2**. It is saved during demo prep and committed
to the repo.

- [ ] Load the prepared project file
- [ ] Show the plan on a grid, an L-shaped outline drawn on top, and an imported Underlay
- [ ] Shear Lines and Lateral Elements on each Level; one Level copied from the Level below
- [ ] Enter F_x, seismic weight, S_DS, I_e, and wind plf
- [ ] Diaphragm Reactions, shear, unit shear, and F_px for each Level
- [ ] Chord forces, including the drag force at the Re-entrant Corner
- [ ] Collector force diagrams along each Shear Line
- [ ] Opening reduces the load and the net depth
- [ ] Shear Line that stops: Transfer Force into the Diaphragm below and its Collector plf
- [ ] Story shear accumulated down to the ground-story Lateral Elements
- [ ] Switch Load Cases and show the Envelope; strength and ASD side by side
- [ ] Click an element to see its Demand × ρ or × Ω₀
- [ ] Move a Shear Line and the Demands update right away
- [ ] Save, reload the page, load the file back
- [ ] _(if time)_ Seismic code calc: look up S_DS from the site and fill in F_x and F_px automatically

### Build phases: vertical slices in two tracks

Each phase is a **vertical slice** within its track. It goes from input to
calculation to display, and ends with a merge to `main` and an app we can demo.
If time runs out, we demo the last phase that's finished. The tracks only meet
at the **plan model** (which is also the save file format), agreed in phase 0.

| Time | **Track A: calc engine + results (Hamid)** | **Track B: plan editor (Aidan)** |
|------|--------------------------------------------|----------------------------------|
| 11:00–11:45 | **Phase 0 (together):** agree on the plan model (= save file) as TypeScript types; set up the Vite app | ← same |
| 11:45–12:30 | **A1:** one Level, rectangle, F_x psf → simple-beam Diaphragm Reactions for each Shear Line; results table; unit tests from the research worked example | **B1:** Grid + rectangle outline; click Gridlines to add Shear Lines; load form |
| 12:30–1:15 | **A2:** Diaphragm shear, unit shear, moment, Chords, F_px; L/T shapes (varying depth, Re-entrant Corner drag force); Openings | **B2:** Drawing mode for L/T outlines + shape check; Openings |
| 1:15–2:00 | **A3:** Collectors (Lateral Elements on each line, split by length); wind; Load Cases + Envelope; strength/ASD | **B3:** Place Lateral Elements on Shear Lines; draw diagrams and labels on the plan; Load Case picker |
| 2:00–2:45 | **A4:** Multiple Levels: story shear, Transfer Forces + their Collectors; detail panel with ρ/Ω₀ | **B4:** Levels (add = copy below, Level picker); save/load JSON + autosave |
| 2:45–3:30 | **A5:** Seismic code calc (C_s, USGS site lookup, F_x for each Level, F_px, §12.3.3.4 25% increase) → fills the inputs | **B5:** Image/PDF import as a scaled Underlay to trace |
| 3:30–3:45 | Integration buffer | ← same |
| 3:45–4:00 | Demo prep | ← same |
| ★ stretch | Wind code calc (ASCE 7-22 Ch. 27) | Automatic plan detection from an image |

## 6. Constraints

- **Time:** 11:00 AM – 4:00 PM (5 hours)
- **Team:** Hamid (Track A), Aidan (Track B)
- **Tech stack:** React + TypeScript + Vite, plan view in SVG. The calc engine is a separate module of pure TypeScript functions, tested with Vitest. No backend; runs in the browser.
- **Git:** branches `track-a` and `track-b`; merge to `main` at the end of each phase. Changes to the plan model types need a quick check with each other first.
- **Code:** ASCE 7-22
- **Units:** imperial only (ft, kips, plf, psf)
- **Diaphragm:** flexible only

## 7. Scope

### In

- Orthogonal outlines where every straight X or Y cut passes through one continuous piece: rectangle, L, T, +
- A separate plan for each Level; "add level" copies the Level below
- Orthogonal Shear Lines; one or more Lateral Elements on each line
- Rectangular Openings
- Transfer Forces where a Shear Line stops
- Four Load Cases + Envelope, at strength and ASD
- Save/load JSON + autosave
- Seismic code calc (phase A5)

### Out

- Rigid and semi-rigid diaphragms; accidental torsion (not required for flexible diaphragms)
- Member **design** and sizing. The app reports Demands only.
- U, H, C, and courtyard outlines (rejected with a message)
- Skewed (non-orthogonal) Shear Lines
- Chord forces around Openings (a warning is shown instead)
- Splitting a line's force among Lateral Elements by stiffness (split by length only)
- Load combinations beyond the 0.7 (seismic) and 0.6 (wind) ASD factors
- Different wind values for each Level
- Overriding ρ or Ω₀ on individual elements
- Multi-page PDF import
- Metric units
- 3D models; import from Revit or other BIM tools
- Hosting or deployment
- _Stretch only:_ wind code calc, automatic plan detection from images

## 8. Design decisions (from grilling)

### Geometry

- **Outline shapes:** every straight cut across the plan in X or Y must pass through one continuous piece. A cut through two pieces would mean two separate Diaphragms in that direction, which needs a different model.
- **Each Level has its own plan:** outline, Shear Lines, Lateral Elements, and Openings. A new Level starts as a copy of the Level below.
- **Shear Lines** are orthogonal and run across the full Diaphragm depth at their position.
- **Openings** are rectangular and orthogonal. They are removed from the seismic load area, and the net depth is used for unit shear wherever a section or Shear Line passes through one. No chord forces around Openings; show a warning.
- **Import:** PNG/JPG or the first page of a PDF (pdf.js), one Underlay per Level, scaled by two clicked points and a typed distance.

### Loads

- **Seismic F_x** is entered as psf for each Level (strength level, C_s already applied) and used for Shear Lines and Lateral Elements.
- **F_px** is calculated by the app for each Level: F_px = (ΣF_i / Σw_i) × w_px, with a floor of 0.2·S_DS·I_e·w_px and a ceiling of 0.4·S_DS·I_e·w_px (ASCE 7 §12.10.1.1). Uses the net area (Openings removed). Applies to the Diaphragm, Chords, and Collectors.
- **Wind:** one plf per direction, applied as-is to every Level's Diaphragm.
- **Load Cases:** Seismic X, Seismic Y, Wind X, Wind Y, plus the Envelope (governing Demand for each element).
- **Strength and ASD** are shown side by side: 0.7 for seismic, 0.6 for wind.
- **ρ and Ω₀:** Demands in tables and on the plan are shown **without** ρ or Ω₀. The detail panel for a single element shows its Demand × ρ (Lateral Elements) or × Ω₀ (Collectors). ρ and Ω₀ are each one value for the whole building. Diaphragm and Chords never get either.
- **Code calcs come last** (phase A5): seismic first, using C_s from S_DS, S_D1, R, I_e, and T, with an optional USGS site lookup; vertical distribution to F_x; F_px; and the §12.3.3.4 25% increase where it applies. The wind code calc is a stretch goal.

### Calculations

- **Diaphragm Reactions** come from treating each Diaphragm Span as a **simple beam under its actual load** (varying depth, Openings, Transfer Force point loads), **not** from tributary area. See [ADR 0001](docs/adr/0001-simple-beam-statics-not-tributary-area.md).
- **Chords:** T = C = M/d along each span, with d being the depth at that point.
- **Re-entrant Corners:** the drag force M/d at the narrower depth is calculated and reported. The corner is not marked on the plan.
- **Collectors:** force diagram along each Shear Line, with Diaphragm shear coming in along the full line and going out at the Lateral Elements.
- **Lateral Elements on one line** share the line's force by length (equal unit shear). Each element reports plf and total force.
- **Story shear** accumulates down Shear Lines that continue. A line continues if the Level below has a Shear Line at the same position and orientation (±0.5 ft).
- **A Shear Line that stops:** its story shear becomes a **Transfer Force**, a point load on the Diaphragm below at the line's position. It is distributed with the same simple-beam statics and adds to that Diaphragm's shear and Chord forces. A **Collector** is shown in the Diaphragm below along the line of the stopped wall, over the full Diaphragm depth there, with Demand **plf = P / depth** and a force diagram. If the line's position is outside the Diaphragm below, show an error.

### Process

- **Two tracks:** Hamid builds Track A (calc engine + results), Aidan builds Track B (plan editor). They meet only at the plan model, which is also the save file format.
- **Save/load:** Save downloads a `.json` project file, Load opens one, and the app autosaves to browser storage.
- **Demo:** runs locally, starting from a prepared project file committed to the repo.

## 9. Decisions log

| When | Decision | Why |
|------|----------|-----|
| Setup | Flexible diaphragms only | Keeps the scope doable in a hackathon; this is the defined subject |
| Setup | Calculate Demands along the full load path: Diaphragm, Chords, Collectors, Lateral Elements | Team requirement; gives a complete lateral load path, not just line forces |
| Setup | Build in vertical-slice phases | Always have something to demo; if time runs out, demo the last finished phase |
| Setup | Use LAVA as inspiration only; keep the app much simpler | LAVA is too complex for what we need (see section 10) |
| Setup | Three geometry input modes: grid, drawing, import | Engineers start from different places: a grid, a sketch, or an existing drawing |
| Grill R1 | React + TypeScript + Vite + SVG; pure-TS calc engine tested with Vitest | SVG makes interaction easy; a pure calc module can be built and tested separately from the UI |
| Grill R1 | ASCE 7-22 | Current edition (2024 IBC, 2025 CBC); one edition keeps testing simple |
| Grill R1 | L/T shapes calculated directly, not split into rectangles | Real plans are rarely rectangles |
| Grill R1 | Each Level has its own Shear Lines, copied from the Level below | Real buildings change from Level to Level |
| Grill R1 | Openings and save/load are in scope | Stairs are common; losing work on refresh is not acceptable |
| Grill R2 | Two tracks: Hamid (calc engine), Aidan (plan editor) | Two-person team; the tracks only meet at the plan model |
| Grill R2 | Seismic input is F_x; the app reports F_px for the Diaphragm | Matches the two force levels in ASCE 7 |
| Grill R2 | Simple-beam statics instead of tributary area | Diagrams must balance; see ADR 0001 |
| Grill R2 | A Shear Line that stops transfers its force to the Diaphragm below, with a Collector shown there | Completes the load path instead of just flagging it |
| Grill R2 | Demands shown without ρ/Ω₀; factors only in the element detail panel | Demand reporting stays clean; factors belong to the design of individual elements |
| Grill R2 | Seismic code calc at the end; wind code calc is a stretch goal | User-entered loads unblock everything else; ASCE 7-22 wind has no simplified method |
| Grill R3 | F_px from F_x, seismic weight, S_DS, and I_e | Needed for the ASCE 7 §12.10.1.1 floor and ceiling |
| Grill R3 | One wind plf per direction, applied to every Level | Exact for one story, close enough for a hackathon |
| Grill R3 | Phase plan for two tracks (section 5) | Each track always has something to demo; risky items are stretch goals |
| Grill R4 | Lateral Elements on a line share force by length | Standard for wood shear walls; no stiffness inputs needed |
| Grill R4 | Import PNG/JPG and the first page of a PDF | One plan sheet per Level covers the normal workflow |
| Grill R4 | Numbered Gridlines vertical, lettered horizontal; spacings typed as a list | Common US convention; fast to enter real grids |
| Grill R4 | Branches `track-a` / `track-b`, merged at phase ends | Matches the "working app after every phase" rule |
| Grill R4 | Demo runs locally from a prepared project file | No deployment risk; shows every feature in 2 minutes |

## 10. Inspiration and references

### Project docs

- [GLOSSARY.md](GLOSSARY.md): the project vocabulary
- [ADR 0001: Simple-beam statics instead of tributary area](docs/adr/0001-simple-beam-statics-not-tributary-area.md)
- [Research: ASCE 7 lateral demands for a flexible-diaphragm plan app](docs/research/asce7-flexible-diaphragm-lateral-demands.md): formulas, a worked example for unit tests, and the USGS API. Items marked UNVERIFIED could not be checked against the ASCE 7-22 text. **Where the research and this file disagree, this file wins.** For example, the research suggests requiring Shear Lines to stack, but we calculate Transfer Forces instead.

### LAVA (CBS2 LLC): video "A Quick Tour of LAVA"

- **Link:** https://www.cbs2llc.com/learn/a-quick-tour-of-lava
- **What it is:** Windows desktop software that analyzes **and designs** wood-framed structures (lateral and vertical), using extensive material databases.
- **How we use it:** as **inspiration only**. It's a similar idea but more complex than we need. Watch the video as a team for ideas on the plan-view workflow and how results are shown.
- **How we stay simpler:**

  | LAVA | Our app |
  |------|---------|
  | Desktop install (Windows) | Runs in the browser, nothing to install |
  | Lateral **and** vertical analysis | Lateral only |
  | Analysis **and design**, with material databases | **Demands only**, no material design |
  | Many features and options | One clear path: plan → lines → loads → Demands |

- **Ideas to borrow** _(fill in after watching the video)_:
  - _TBD_
