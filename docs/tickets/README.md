# Tickets

Each ticket is a vertical slice: it ends with something that works in the app or
in the tests. Ticket IDs match the phases in [problem.md](../../problem.md):
ticket `A2.1` is the first ticket of phase A2.

**Type:**
- **AFK:** an agent can do it alone from the ticket and the spec.
- **HITL:** needs humans to decide or check.

## How to work a ticket

1. Pick the next ticket in your track whose blockers are merged.
2. On your branch (`track-a` or `track-b`), ask Claude Code:
   > Implement `docs/tickets/<file>.md`. Follow `docs/spec.md` and `GLOSSARY.md`. Run `npm test`.
3. Check the acceptance criteria, then commit.
4. At the end of each phase, merge to `main` and pull the other track's work.
5. **Changing anything in `src/model/`:** tell the other person first.

## Board

| ID | Title | Track | Phase · time | Type | Blocked by |
|----|-------|-------|--------------|------|------------|
| [P0.1](P0.1-scaffold-app.md) | Scaffold the app | Both | 0 · 11:00–11:45 | AFK | — |
| [P0.2](P0.2-plan-model-and-skeleton.md) | Plan model, results types, fixtures, App skeleton | Both | 0 · 11:00–11:45 | **HITL** | P0.1 |
| [A1.1](A1.1-diaphragm-reactions.md) | Diaphragm Reactions on one rectangular Level | A | A1 · 11:45–12:30 | AFK | P0.2 |
| [A2.1](A2.1-diaphragm-diagrams-fpx-chords.md) | Diaphragm diagrams, F_px, Chords | A | A2 · 12:30–1:15 | AFK | A1.1 |
| [A2.2](A2.2-shapes-corners-openings-overhangs.md) | L/T shapes, Re-entrant Corners, Openings, Overhangs, validation | A | A2 · 12:30–1:15 | AFK | A2.1 |
| [A3.1](A3.1-lateral-elements-collectors.md) | Lateral Elements and Collectors | A | A3 · 1:15–2:00 | AFK | A2.1 |
| [A3.2](A3.2-wind-cases-envelope-asd.md) | Wind, Load Cases, Envelope, strength/ASD, Warnings bar | A | A3 · 1:15–2:00 | AFK | A3.1 |
| [A4.1](A4.1-levels-story-shear-transfers.md) | Multiple Levels: story shear, Transfer Forces | A | A4 · 2:00–2:45 | AFK | A3.1 |
| [A4.2](A4.2-detail-panel.md) | Detail panel with ρ and Ω₀ | A | A4 · 2:00–2:45 | AFK | A3.2 |
| [A5.1](A5.1-seismic-code-calc.md) | Seismic code calc + USGS lookup | A | A5 · 2:45–3:30 | AFK | A4.1 |
| [B1.1](B1.1-plan-view-grid-load-form.md) | Plan view, Grid mode, Shear Lines on Gridlines, Load form | B | B1 · 11:45–12:30 | AFK | P0.2 |
| [B2.1](B2.1-drawing-mode.md) | Drawing mode for outlines and Shear Lines | B | B2 · 12:30–1:15 | AFK | B1.1 |
| [B2.2](B2.2-openings.md) | Openings | B | B2 · 12:30–1:15 | AFK | B1.1 |
| [B3.1](B3.1-lateral-elements-select-move.md) | Lateral Elements, select, move Shear Lines | B | B3 · 1:15–2:00 | AFK | B1.1 |
| [B3.2](B3.2-results-on-plan.md) | Results on the plan, Load Case picker, Strength/ASD | B | B3 · 1:15–2:00 | AFK | B3.1 (+ A2.1, A3.1 for data) |
| [B4.1](B4.1-levels.md) | Levels: add (copy below), picker, delete | B | B4 · 2:00–2:45 | AFK | B1.1 |
| [B4.2](B4.2-save-load-autosave.md) | Save/load JSON + autosave | B | B4 · 2:00–2:45 | AFK | P0.2 |
| [B5.1](B5.1-import-underlay.md) | Import image/PDF as Underlay | B | B5 · 2:45–3:30 | AFK | B1.1 |
| [D.1](D.1-demo-project-and-script.md) | Demo project file + script | Both | 3:30–4:00 | **HITL** | all above |
| [S.1](S.1-wind-code-calc.md) | ★ Wind code calc | A | stretch | **HITL** | A5.1 |
| [S.2](S.2-automatic-plan-detection.md) | ★ Automatic plan detection from an image | B | stretch | **HITL** | B5.1 |

## Dependencies

```
P0.1 → P0.2 ─┬─ A1.1 → A2.1 ─┬─ A2.2
             │               └─ A3.1 ─┬─ A3.2 → A4.2
             │                        └─ A4.1 → A5.1 → S.1
             │
             ├─ B1.1 ─┬─ B2.1, B2.2, B3.1 → B3.2 (draws A2.1/A3.1 data as it lands)
             │        ├─ B4.1
             │        └─ B5.1 → S.2
             └─ B4.2

Everything → D.1
```

## Where the tracks meet

| Thing | Owner | Used by |
|-------|-------|---------|
| `src/model/*` types, fixtures, `crossSection` | Both (P0.2) | Both |
| `checkOutline` in `src/model/outline.ts` | A (A2.2) | B2.1 shows its message |
| `analyze()` results | A | B3.2 draws them |
| `selection` | B sets it from plan clicks; A sets it from table rows | A4.2 Detail panel |
| `caseId`, `showAsd` | B toolbar (B3.2). A3.2 adds a case switch inside the Results panel | Both |
