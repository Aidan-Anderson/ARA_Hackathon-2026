# Demo script (2 minutes)

Follows the checklist in [problem.md §5](../problem.md#5-what-done-looks-like-the-demo).
Skip any step marked _(if merged)_ whose ticket did not make it to `main`.

## Before you start

- `npm run dev` on the demo laptop, browser full screen.
- Click **New** so the autosave from rehearsal is gone.
- Have `demo/demo-project.json` and a PNG floor plan ready in the file picker's folder.

## The building

`demo-project.json` is a 90 × 50 ft L-shaped, two-story building on Gridlines 1–4 / A–C:

| | Level 2 | Roof |
|---|---|---|
| Y Shear Lines | 1, 4 | 1, **3**, 4 |
| X Shear Lines | A, C | A, C |
| Opening | stair, x 10–20, y 30–40 | — |
| F_x / weight (psf) | 8 / 60 | 10 / 30 |

Building: S_DS 1.0, I_e 1.0, wind 200 plf (X) and 250 plf (Y), ρ 1.0, Ω₀ 3.0.
**Roof line 3 has no line below it**, so it becomes a Transfer Force into Level 2.

## Walkthrough

| Time | Do | Say |
|---|---|---|
| 0:00 | **Load** → `demo-project.json` | "Lateral load path for flexible diaphragms. Here's a two-story L-shaped building." |
| 0:10 | Point at the Gridlines and the L outline. _(if merged)_ Import mode: show the Underlay. | "Plan on a grid; the outline is drawn on top, or traced from an imported drawing." |
| 0:20 | Level picker → **Roof**. Toggle **Ghost**. | "The Roof was made with '+ Level', a copy of Level 2. The ghost shows Level 2 underneath, so you can see line 3 has nothing below it." |
| 0:30 | **Loads** tab: point at S_DS, I_e, wind, F_x, weight | "Inputs are building-wide loads plus F_x and weight per Level." |
| 0:40 | **Results** tab, case **SY**, Roof | "Simple-beam Diaphragm Reactions per span, shear and unit shear, and F_px with its min/max." |
| 0:50 | Point at the Chords and the Re-entrant Corner row | "Chord forces, including the drag force at the inside corner of the L." |
| 1:00 | _(if merged)_ Plan overlay: Collector diagrams along each line | "Collector force diagram along every Shear Line." |
| 1:10 | Level picker → **Level 2**. Point at the stair Opening and Transfers. | "The stair Opening cuts the load and the net depth. Roof line 3's story shear comes down here as a Transfer Force, with its Collector plf." |
| 1:25 | Point at story shear on lines 1 and 4 | "Story shear accumulates down to the ground-story walls and frames." |
| 1:35 | Case picker → **WY**, then **ENV**. _(if merged)_ Strength/ASD toggle. | "Wind cases, and the Envelope names the governing case." |
| 1:45 | Click a wall row → **Detail** tab | "Each element's Demand in every case, times ρ or Ω₀." |
| 1:50 | _(if merged)_ Drag a Shear Line; results update | "Move a line and every Demand updates right away." |
| 1:55 | Refresh the page | "Autosaves, and saves to a JSON file you can load back." |

_(if time)_ **Code calc** tab: look up S_DS from the site and fill F_x and F_px.

## Rehearsal

- [ ] `demo/demo-project.json` loads cleanly on the demo laptop
- [ ] Every step above is visible (strike the ones that aren't merged)
- [ ] Timed run-through: ____ (target ≤ 2:00)
