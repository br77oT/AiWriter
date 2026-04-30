## Parent PRD

`prd/PRD.md`

## What to build

The Validation Engine deep module per PRD §"Validation Engine" and §"Two-layer validation", plus a working right-rail UI that renders the report.

This slice lands **before** the Spec/Outline/Checks panels intentionally — per PRD §Testing Decisions ("the Validation Engine should land first and set the pattern, since it is the most test-friendly shape"). Tests use seeded Document fixtures since the editing panels don't yet exist; a small dev-only seeder lets the user pick a fixture and see the rail render.

Deliverables:

- **Validation Engine module** with the single signature `validate(draft, outline, checks) → ValidationReport`. Internally split into:
  - **Structural Evaluator** — for each outline section: `present` / `thin` / `missing` (with optional note for `thin`).
  - **Question Evaluator** — for each check: `answered` / `partial` / `missing`. `answered`/`partial` MUST include an `evidence` quoted span from the draft. `partial`/`missing` MUST include a `suggestion` for the gap.
  - **Coverage score** — e.g. "5/6 checks answered, 4/5 sections present". Surfaced both in the report and as a single completion signal in the UI.
- **Stubbed model boundary** — the Question Evaluator calls an LLM behind a small interface; tests inject a deterministic stub. The real provider can be wired in after this slice but the interface is fixed here.
- **API**: `POST /validate { documentId } → ValidationReport`. Persists nothing on its own — Slice 011 adds versioning later.
- **Right rail UI** per `prd/make ux wireframes.md` "Validation view" — Structure section (✓/~/✗ per outline section), Document Checks section (status + evidence + suggestion), coverage score badge.
- **"Validate" button** (top bar, was placeholder in Slice 001) — runs validation on demand on the current document.
- **Incremental updates on draft edit** — when the user edits the draft text directly (even though there's no full draft editor yet, treat any draft mutation), validation re-runs and the rail updates. Debounce to avoid storm.

## Acceptance criteria

- [ ] `validate(draft, outline, checks)` is callable as a pure function from a unit test, no UI involved.
- [ ] Structural Evaluator returns `present` / `thin` / `missing` per required outline section; non-required sections are reported but never `missing`.
- [ ] Question Evaluator returns `answered` / `partial` / `missing` per check; `answered` and `partial` include an `evidence` field with a quoted span from the draft; `partial` and `missing` include a `suggestion`.
- [ ] Coverage score arithmetic is correct (verified by unit test) and surfaced both in the report object and the UI.
- [ ] Re-running validation on identical inputs returns an identical report (stability, per PRD §"Validation is deterministic from the draft").
- [ ] Empty draft, empty checks, and empty outline are handled without crashing — produce sensible empty reports.
- [ ] Tests cover every check status, every structural status, evidence presence rules, coverage arithmetic, stability, and the three empty-input edge cases. This test suite establishes the pattern referenced by every later slice.
- [ ] `POST /validate` endpoint returns a `ValidationReport` for a stored Document.
- [ ] Right rail renders the report including Structure list, Checks list with evidence + suggestions, and coverage score.
- [ ] "Validate" button in the top bar runs validation on demand and updates the rail.
- [ ] Draft mutations trigger debounced re-validation (incremental updates).

## Blocked by

- Blocked by `issues/001-project-skeleton-and-walking-skeleton.md`

## User stories addressed

- User story 19 (validation results in persistent right rail)
- User story 20 (structure ✓ / ~ / ✗ per required section)
- User story 21 (questions answered / partial / missing)
- User story 22 (evidence quote from draft)
- User story 23 (suggested fix on missing/partial)
- User story 38 ("Validate" button on demand)
- User story 41 (validation updates incrementally on draft edits)
- User story 42 (coverage score as single completion signal)
