# Lateral Load Path app (Hackathon 2026)

Browser app that distributes lateral loads through flexible diaphragms. Two
tracks build it in parallel: Track A is the calc engine and results panels;
Track B is the plan editor.

## Read first

- `GLOSSARY.md`: the domain language. Use its terms in code, UI labels, and commit messages.
- `docs/spec.md`: types, calculation rules, UI layout, and test fixtures with expected values.
- `docs/tickets/<id>.md`: when implementing a ticket. Its acceptance criteria are the finish line.

When documents disagree: `problem.md` > `docs/spec.md` > `docs/research/`.

## Conventions

- `src/engine/` is pure TypeScript: `analyze(project: Project): Results`. React and the DOM live in `src/ui/`. Network calls live only in `src/engine/seismicCode.ts`.
- Engine units are ft, kips, and kip-ft. Convert psf and plf at the engine boundary (÷ 1000) and report plf as kips/ft × 1000.
- Diaphragm Reactions come from simple-beam statics on each Diaphragm Span under its actual load (`docs/adr/0001-*`).
- Test the engine through `analyze()` with the fixtures in `src/model/fixtures/`, checking against the expected values in spec §7.2.
- Work inside your track's files (spec §4.1). `src/model/` and `src/App.tsx` are shared: when you change them, say so in the commit message so the other track knows to pull.

## Done

A ticket is done when its acceptance criteria pass and `npm test`, `npm run build`, and `npm run lint` are all green.
