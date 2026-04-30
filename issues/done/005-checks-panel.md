## Parent PRD

`prd/PRD.md`

## What to build

The Checks panel per PRD §"Checks Module" — a list editor for the questions the draft must answer, replacing the placeholder Checks pane from Slice 001.

Per PRD §Schema, a Check is `{ id, question }`. Editor capabilities:

- Add / edit / remove individual questions (one question per line in the editor).
- Stable IDs across reorder (so Validation reports keyed by `checkId` remain stable).
- Two persisted toggles:
  - **Evaluate after every generation** — default ON. Wires up in Slice 006 (Generation runs validate automatically when this is on).
  - **Block export if any check is missing** — default OFF. Enforced in Slice 012 (Export).
- "Load template" button is a placeholder in this slice; Slice 009 wires it to the Template Library.

Note: this slice deliberately does not implement template-loading or the export-blocking enforcement — only the editor and the persisted toggle state.

## Acceptance criteria

- [ ] Checks pane renders the question list and the two toggles for the current document.
- [ ] Add / edit / remove questions persist and survive reload.
- [ ] Each question has a stable ID; the IDs are referenced in `ValidationReport.questions[].checkId` from Slice 002.
- [ ] Both toggles persist and survive reload. Their effect is verified by later slices but the state must be readable here.
- [ ] Switching documents loads the correct checks without bleed.
- [ ] Validation rail (from Slice 002) reflects check changes — adding a question shows it in the rail with status; removing one removes its row.
- [ ] Tests cover: add/edit/remove round-trip; toggle state round-trips; check IDs survive edits to other checks.

## Blocked by

- Blocked by `issues/001-project-skeleton-and-walking-skeleton.md`

## User stories addressed

- User story 8 (list of questions the document must answer)
- User story 10 (add, edit, and remove individual check questions)
- User story 11 (toggle "evaluate after every generation")
- User story 12 (toggle "block export if any check is missing")
