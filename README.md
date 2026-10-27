# Lateral Load Path

A browser app for distributing lateral loads in buildings with flexible
diaphragms. You build each level's plan (on a grid, by drawing, or by tracing an
imported drawing), place shear lines, lateral elements, and openings, and enter
the loads. The app calculates the demands along the whole load path:
diaphragm shear and unit shear, chords, collectors, lateral elements, story
shear, and transfer forces. Built at Hackathon 2026 by Hamid and Aidan.

## Quick start

Needs Node 20+.

```
npm install
npm run dev      # app at http://localhost:5173
npm test         # engine tests (Vitest)
npm run build    # type-check + production build
npm run lint     # Oxlint
```

## Docs

- [problem.md](problem.md): what we're building, scope, and decisions
- [docs/spec.md](docs/spec.md): types, calculation rules, UI, test fixtures
- [GLOSSARY.md](GLOSSARY.md): domain terms used in code and UI
- [docs/tickets/](docs/tickets/README.md): the build plan, ticket by ticket
- [docs/adr/](docs/adr/): architecture decisions
- [docs/research/](docs/research/): ASCE 7-22 research notes

## Workflow

- Track A (calc engine + results) works on `track-a`; Track B (plan editor) works on `track-b`.
- Both merge to `main` at the end of each phase.
- To implement a ticket with Claude Code:
  > Implement `docs/tickets/<file>.md`. Follow `docs/spec.md` and `GLOSSARY.md`. Run `npm test`.
