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
**flexible diaphragms**. The user draws a floor plan, places the lines of
lateral force-resisting system (LFRS), and enters the lateral load parameters.
The app then calculates the code-level forces, distributes them to each
resisting line by **tributary area**, and calculates the demands along the
**whole lateral load path**:

- **Diaphragm:** shear and unit shear (plf) along each resisting line
- **Chords:** tension and compression forces from diaphragm bending
- **Collectors (drag struts):** axial forces along the lines where they gather diaphragm shear into the resisting elements
- **Lateral force-resisting system (LFRS):** total demand on each resisting line

### User flow

1. **Design the plan.** Draw the building footprint in an interactive plan view.
2. **Place the LFRS.** Mark where the lateral resisting lines are (e.g. shear walls, braced frames) in each direction.
3. **Define the loads.** Fill in a form with the lateral load parameters.
4. **Calculate forces.** The app computes the design lateral forces using the relevant code.
5. **Distribute to lines.** Since the diaphragm is flexible, the app assigns load to each resisting line by its tributary area.
6. **Follow the load path.** Calculate the diaphragm shears, chord forces, collector forces, and LFRS line demands.
7. **Show the demands.** Display every demand on the plan and in tables.

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

- [ ] Draw a building plan in the browser
- [ ] Place resisting lines in both directions
- [ ] Enter the lateral load parameters in a form
- [ ] App calculates the code-based lateral force
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
| 1 | **Walking skeleton** | Rectangular plan (L × B), click to place resisting lines in one direction, type a uniform load *w* (plf) | Tributary width per line → line force | Lines drawn on the plan, tributary zones shaded, force on each line | 11:45 – 12:45 |
| 2 | **Code loads, both directions** | Load form (seismic and/or wind parameters), lines in both directions | Code base shear → *w* (plf) in each direction | Line forces in N-S and E-W | 12:45 – 1:30 |
| 3 | **Diaphragm** | (no new input) | Diaphragm shear and unit shear *v* (plf) at each line | Shear diagram, unit shear labels | 1:30 – 2:00 |
| 4 | **Chords** | (no new input) | Diaphragm moment per span → chord force T = C = M / d | Moment diagram, chord forces on the plan edges | 2:00 – 2:40 |
| 5 | **Collectors** | Length and position of the wall or frame along each line | Collector force along the line (diaphragm shear in, LFRS shear out) | Collector force diagram on each line | 2:40 – 3:20 |
| 6 | **Interactive polish** | Drag lines, edit the plan | Results recalculate live | Smooth live updates; export if there's time | 3:20 – 3:45 |
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
- **Seismic weight:** does the user enter a total W, or area loads (psf) that get multiplied by the plan area?
- **Diaphragm force:** distribute the story force, or the diaphragm design force F_px?
- **Stories:** single story only, or multiple stories?
- **Plan shape:** rectangles only, or polygons and L-shapes?
- **Line orientation:** orthogonal lines only (N-S / E-W)? Snap to a grid?
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
