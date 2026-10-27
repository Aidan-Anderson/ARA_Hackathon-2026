# D.1 — Demo project file + script

- **Track:** both
- **Phase:** 3:30–4:00 (15 min integration buffer + 15 min demo prep)
- **Type:** **HITL**
- **Blocked by:** everything that's merged by 3:30. Demo what works.

## What to build

1. **Merge both tracks to `main`.** Run `npm test`, then `npm run dev` on the demo laptop.
2. **Build `demo/demo-project.json`** in the app and save it. It has:
   - 2 Levels with an L-shaped outline
   - one Opening (a stair)
   - one Shear Line on the Roof that stops at Level 2, so there's a Transfer Force
   - S_DS, I_e, F_x, and weights filled in, plus a wind value in each direction
   - an Underlay on one Level, if B5.1 is done
   - Commit the file.
3. **Write `demo/script.md`:** a 2-minute walkthrough following the checklist in [problem.md §5](../../problem.md#5-what-done-looks-like-the-demo). Skip any item that isn't working.
4. **Rehearse once** and time it.

## Acceptance criteria

- [ ] `demo/demo-project.json` loads cleanly on the demo laptop
- [ ] Every item in the script is visible in the app
- [ ] The run-through takes 2 minutes or less
