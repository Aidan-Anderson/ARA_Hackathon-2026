# S.2 — ★ Automatic plan detection from an image (stretch)

- **Track:** B (Aidan)
- **Phase:** stretch, only if ahead of schedule
- **Type:** **HITL**. Needs an API key and a human check of what comes back.
- **Blocked by:** B5.1

## What to build

1. **"Detect plan" button** on a calibrated Underlay. It sends the image to a vision-capable model (e.g. the Claude API).
   - Ask for JSON: the outline polygon and the wall lines, in **image pixels**.
   - Check the provider's docs for the current model id and how to call it directly from a browser.
2. **API key:** the user pastes it into a field. It is **never saved** in the project or in localStorage. Local demo use only.
3. **Convert the result:**
   - Snap the pixels to plan coordinates with `ftPerPx` and the Underlay position.
   - Make edges orthogonal and snap to 1 ft.
   - Run `checkOutline`.
4. **Preview:** show the detected outline and lines as a preview. The user clicks **Accept** to replace the Level's outline and add Shear Lines, or **Discard**.

## Acceptance criteria (manual)

- [ ] For a simple rectangular or L-shaped plan image, the detected outline is within about 2 ft after snapping
- [ ] Nothing changes in the project until Accept is clicked
