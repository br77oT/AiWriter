## Parent PRD

`prd/PRD.md`

## What to build

The Spec panel per PRD §"Spec Module" — replace the placeholder Spec pane from Slice 001 with a real editor for the persistent rules and constraints layer.

Fields, all persisted to `Document.spec`:

- **Goal** — textarea, free text.
- **Tone** — textarea, free text.
- **Audience** — short text input. Drives tone/vocabulary calibration in later generation slices.
- **Must-include** — list editor (one rule per line, add/remove).
- **Must-avoid** — list editor (one phrase per line, add/remove).

Saves are persisted via the existing Document API (extend `PUT /document/:id` or equivalent — the granularity is up to the implementer, but spec edits must round-trip through the store).

Per PRD §"Architectural decisions" — the Spec is part of the source of truth and must never be silently mutated by generation. This slice does not implement that guarantee (Slice 006 does), but the persistence layer here must give later slices something stable to read.

## Acceptance criteria

- [ ] Spec pane renders the five fields (goal, tone, audience, must-include, must-avoid) for the current document.
- [ ] Edits persist through the Document store and survive a page reload.
- [ ] Must-include and must-avoid are list editors, not free-text textareas (so each rule is treated as a discrete item).
- [ ] Switching to another document in the sidebar swaps the Spec content without bleed.
- [ ] Tests cover: spec round-trips through the store; list-editor add/remove operates on the persisted shape; switching documents loads the correct spec.

## Blocked by

- Blocked by `issues/001-project-skeleton-and-walking-skeleton.md`

## User stories addressed

- User story 1 (persistent Spec panel for goals, tone, constraints)
- User story 2 (must-include and must-avoid as separate hard constraints)
- User story 3 (audience field for tone/vocabulary calibration)
