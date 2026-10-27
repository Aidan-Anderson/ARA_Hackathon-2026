# Problem — Hackathon 2026

> **Status:** DRAFT. Subject defined, ready for research and grilling.
> Items marked _(assumed)_ are guesses. Confirm or fix them during grilling.
> **Time box:** 11:00 AM – 4:00 PM (5 hours). Everything below has to fit in that.
> **Team:** Hamid, Aidan, Garrett

## How to use this file

This file is where the team agrees on what we're building. Fill in the sections
below. Rough notes are fine. Then run the pipeline in order:

1. **Research**: run `/research` on anything listed under *Open questions*.
2. **Grill**: run `/grilling` against this file. Write the answers back in here.
3. **Spec**: turn this file into a spec (what we build plus acceptance criteria).
4. **Tickets**: split the spec into small tickets, each one demoable on its own.
5. **Implement**: build one vertical-slice phase at a time (see *Build phases* in section 5). Every phase ends with an app we can demo.

**Rule:** if scope changes, update this file first.

---

## 1. Subject

An interactive plan-view app for distributing lateral loads in buildings with
**flexible diaphragms**. The user creates a floor plan (by drawing it, laying
it out on a grid, or importing it from an image or PDF), places the lines of
lateral force-resisting system (LFRS), and enters the lateral load parameters.
The app then calculates the code-level forces, distributes them to each
resisting line by **tributary area**, and calculates the demands along the
**whole lateral load path**:

- **Diaphragm:** shear and unit shear (plf) along each resisting line
- **Chords:** tension and compression forces from diaphragm bending
- **Collectors (drag struts):** axial forces along the lines where they gather diaphragm shear into the resisting elements
- **Lateral force-resisting system (LFRS):** total demand on each resisting line

### User flow

1. **Design the plan.** Create the building footprint in an interactive plan view, using one of three geometry input modes (see *Geometry input modes* below).
2. **Place the LFRS.** Mark where the lateral resisting lines are (e.g. shear walls, braced frames) in each direction.
3. **Define the loads.** Pick one of two input modes (see *Load input modes* below).
4. **Calculate forces.** In psf mode, the app computes the design lateral forces using the relevant code. In direct-force mode, it uses the force the user entered.
5. **Distribute to lines.** Since the diaphragm is flexible, the app assigns load to each resisting line by its tributary area.
6. **Follow the load path.** Calculate the diaphragm shears, chord forces, collector forces, and LFRS line demands.
7. **Show the demands.** Display every demand on the plan and in tables.

### Geometry input modes

The user chooses how to create the plan:

| Mode | User does | App does |
|------|-----------|----------|
| **Grid-based** | Defines gridlines (e.g. A, B, C… / 1, 2, 3…) and their spacings, then builds the footprint and resisting lines on the grid | Snaps the plan outline and resisting lines to the gridlines |
| **Drawing** | Draws the footprint outline and resisting lines in the plan view | Snaps points and keeps lines orthogonal; editable afterward |
| **Import (image / PDF)** | Uploads a floor plan image or PDF, then sets the scale by clicking two points with a known distance | Shows the drawing as a scaled underlay the user traces over. _Stretch goal:_ detect the outline and walls from the image automatically |

All three modes produce the same plan model (outline + resisting lines), so the
calculations don't care which mode the user picked.

### Load input modes

The user chooses how to define the loads:

| Mode | User enters | App does |
|------|-------------|----------|
| **psf (calculated)** | Area loads in psf (e.g. roof/floor dead load, wall weight) plus the code parameters | Calculates the seismic weight W from psf × area, then the code lateral force |
| **Direct force** | The lateral force itself _(total force in kips or uniform load in plf; confirm in grilling)_ | Skips the load calculation and distributes the entered force |

Either way, everything after the load step (distribution to lines, diaphragm,
chords, collectors) works the same.

## 2. Problem statement

_(assumed)_ Distributing lateral loads to resisting lines in flexible-diaphragm
buildings is usually done by hand or in one-off spreadsheets. Working out
tributary widths and line demands is tedious, easy to get wrong, and hard to
check visually, especially when the plan or wall layout changes.

## 3. Users

_(assumed)_ Structural engineers, especially for early-stage and schematic
lateral design of buildings with flexible diaphragms (e.g. wood or untopped
metal deck).

## 4. Why it matters

_(assumed)_ Fast, visual, repeatable lateral load distribution. When the layout
changes, the demands update right away, so there's no spreadsheet to rework.

## 5. What "done" looks like (the demo)

Describe the 2-minute demo we show at the end.

- [ ] Create a building plan in the browser: on a grid, by drawing it, or by tracing an imported image or PDF
- [ ] Place resisting lines in both directions
- [ ] Enter the loads either as psf (app calculates the force) or as a force directly
- [ ] App calculates the code-based lateral force (psf mode)
- [ ] Multi-story building: app distributes the force to each level
- [ ] App shows the tributary area for each line and the demand on each line (on the plan and in a table)
- [ ] App shows diaphragm unit shears, chord forces, and collector forces
- [ ] Moving or adding a line updates the demands right away

### Build phases: vertical slices _(proposed, confirm in grilling)_

Each phase is a **vertical slice**. It goes all the way through
**input → calculation → display on the plan**, and when it's done we have an
app we can demo. We don't build all the UI first, then all the calcs, then all
the outputs. Each phase adds one new capability end to end on top of the last
one. If time runs out, we demo the last phase that's finished.

| # | Phase | Input (UI) | Calculation | Output (plan + table) | Time _(proposed)_ |
|---|-------|------------|-------------|-----------------------|-------------------|
| 0 | **Plan the work** | `problem.md` | grill → spec → tickets | Tickets ready, app scaffold runs | 11:00 – 11:45 |
| 1 | **Walking skeleton: one level** | **Single level only, no vertical distribution of loads.** **Grid-based** rectangular plan (gridlines + spacings), click a gridline to place a resisting line in one direction, **direct-force mode**: type the force | Tributary width per line → line force | Lines drawn on the plan, tributary zones shaded, force on each line | 11:45 – 12:45 |
| 2 | **Code loads + multi-story, both directions** | **psf mode**: area loads (psf) + code parameters. **Stories**: number of levels, story heights, psf for each level. Lines in both directions | W = psf × area at each level → code base shear → **vertical distribution to each level** → *w* (plf) for each level and direction | Force at each level; line forces in N-S and E-W for each level (level picker) | 12:45 – 1:45 |
| 3 | **Diaphragm** | (no new input) | Diaphragm shear and unit shear *v* (plf) at each line | Shear diagram, unit shear labels | 1:45 – 2:10 |
| 4 | **Chords** | (no new input) | Diaphragm moment per span → chord force T = C = M / d | Moment diagram, chord forces on the plan edges | 2:10 – 2:40 |
| 5 | **Collectors** | Length and position of the wall or frame along each line | Collector force along the line (diaphragm shear in, LFRS shear out) | Collector force diagram on each line | 2:40 – 3:20 |
| 6 | **Geometry tools + polish** | **Drawing mode** (draw the outline and lines), **import mode** (image/PDF underlay + set scale, then trace), drag lines | Results recalculate live from the edited plan | Drawn or traced plan gives the same results as the grid plan; live updates | 3:20 – 3:45 |
| ★ | **Stretch** | Upload a plan image | Detect the outline and walls automatically | Auto-generated plan the user can edit | only if ahead of schedule |
| — | **Demo prep** | | | Rehearse the 2-minute demo | 3:45 – 4:00 |

## 6. Constraints

- **Time:** 11:00 AM – 4:00 PM (5 hours)
- **Team:** Hamid, Aidan, Garrett _(roles TBD)_
- **Tech stack:** _TBD (web app?)_
- **Data / access:** _TBD_
- **Diaphragm:** flexible only (tributary-area distribution)

## 7. Out of scope

_(proposed, confirm in grilling)_

- Rigid and semi-rigid diaphragm analysis (center of rigidity, torsion)
- Member **design** and sizing (sheathing nailing, chord and collector members, shear wall or brace sizing). The app calculates **demands** only.
- 3D modeling and import from Revit or other BIM tools

## 8. Open questions / unknowns

- **Code:** which code and edition? ASCE 7-16 or 7-22? IBC?
- **Load types:** seismic, wind, or both? For seismic, ELF only?
- **Seismic inputs:** does the user type in S_DS, S_D1, R, I_e, and W, or does the app look them up from the site location?
- **Direct-force mode:** does the user enter a total force (kips) for each direction, a uniform load (plf), or a force for each level?
- **psf mode:** which psf inputs? Roof/floor dead load, partitions, and wall weight (psf × tributary wall height)?
- **Diaphragm force:** distribute the story force, or the diaphragm design force F_px?
- **Multi-story (phase 2):** do all levels share the same plan and the same resisting lines, or can each level be different? Do lower-level LFRS lines carry the accumulated story shear from the levels above? Do the diaphragm, chord, and collector phases (3–5) run for every level?
- **Plan shape:** rectangles only, or polygons and L-shapes? Drawing and import modes make non-rectangular plans likely, and those need diaphragms with varying depth in the tributary, chord, and collector calcs.
- **Line orientation:** orthogonal lines only (N-S / E-W)?
- **Grid mode:** do gridlines follow the usual convention (letters one way, numbers the other)? Can spacings be uneven?
- **Import mode:** which formats? PNG/JPG only, or also PDF (render the page in the browser)? Single page only? Is tracing over a scaled underlay enough, or do we want automatic detection (e.g. sending the image to a vision model)?
- **Drawing mode:** snap to grid only, or also free angles?
- **Tributary rule:** half the distance to the next line on each side? How do we handle diaphragms that change depth or plans with re-entrant corners?
- **Chords:** is the chord force just M / d with a simple-span diaphragm moment between resisting lines? How do we treat a continuous diaphragm over interior lines?
- **Collectors:** where do collectors go? Over the full building depth along each line, with shear coming in from the diaphragm on both sides and going out at the wall or frame? Should we show the force diagram along the collector?
- **Overstrength:** do collector demands include the seismic overstrength factor Ω₀ (ASCE 7 §12.10.2.1)?
- **Diaphragm openings:** do we support openings in the diaphragm, or leave them out?
- **Units:** imperial only?
- **Output:** on-screen only, or also export (CSV or PDF report)?
- **Persistence:** do we need save and load?

## 9. Decisions log

| Time | Decision | Why |
|------|----------|-----|
|      | Flexible diaphragms only, with tributary-area distribution | Keeps the scope doable in a hackathon; this is the defined subject |
|      | Calculate demands along the full load path: diaphragm, chords, collectors, LFRS | Team requirement; gives a complete lateral load path, not just line forces |
|      | Event runs 11:00 AM – 4:00 PM; team is Hamid, Aidan, Garrett | Event constraint |
|      | Build in vertical-slice phases (input → calc → display in each phase) | Always have something to demo; if time runs out, demo the last finished phase |
|      | Use LAVA as inspiration only; keep the app much simpler | LAVA is too complex for what we need (see section 10) |
|      | Phase 1 is a single level with no vertical distribution of loads; multi-story is added in phase 2 | Get the plan-view load path working on one level first |
|      | Two load input modes: psf (app calculates the force) and direct force (user enters the force) | Sometimes engineers want the code calculation, sometimes they already know the force |
|      | Three geometry input modes: grid-based, drawing, import from image/PDF. All produce the same plan model | Engineers start from different places: a grid, a sketch, or an existing drawing |
|      | Grid mode is in phase 1; drawing and import come in phase 6; automatic detection from images is a stretch goal | Grid is the simplest path to a working skeleton; tracing over an underlay is much cheaper than automatic detection |

## 10. Inspiration and references

### LAVA (CBS2 LLC): video "A Quick Tour of LAVA"

- **Link:** https://www.cbs2llc.com/learn/a-quick-tour-of-lava
- **What it is:** Windows desktop software that analyzes **and designs** wood-framed structures (lateral and vertical), using extensive material databases.
- **How we use it:** as **inspiration only**. It's a similar idea but more complex than we need. Watch the video as a team for ideas on the plan-view workflow and how results are shown.
- **How we stay simpler:**

  | LAVA | Our app |
  |------|---------|
  | Desktop install (Windows) | _(assumed)_ Runs in the browser, nothing to install |
  | Lateral **and** vertical analysis | Lateral only |
  | Analysis **and design**, with material databases | **Demands only**, no material design |
  | Full building model | One flexible-diaphragm level, simple plan |
  | Many features and options | One clear path: plan → lines → loads → demands |

- **Ideas to borrow** _(fill in after watching the video)_:
  - _TBD_
