## Parent PRD

`prd/PRD.md`

## What to build

The Generation Engine deep module per PRD §"Generation Engine" — full-draft mode only. This slice introduces the LLM provider for real (no longer a stub at the engine boundary).

The engine signature is fixed: `generate(spec, outline, checks, options) → DraftSections`. Callers never touch prompt strings; all prompt orchestration lives behind this interface.

Deliverables:

- **Generation Engine** — full-draft mode produces one section of prose per **unlocked** outline ID. Sections are returned keyed by `outlineId` and stored in `Document.draftSections`.
- **Section-keyed draft storage** per PRD §"Architectural decisions" → "Section-keyed draft" (mapped to outline IDs, not a single blob).
- **Source-of-truth invariant** per PRD §"Architectural decisions" — generation reads from spec + outline + checks; never from the previous draft text. Verified by test.
- **Frozen outline respected** — if `outlineFrozen = true`, generation must NOT add, remove, or rename sections. Verified by test.
- **Spec immutability** — generation must NOT mutate `Document.spec` or `Document.outline`. Verified by test (user story 40).
- **API**: `POST /generate { documentId } → DraftSections` — generates all unlocked sections.
- **UI**: enable the "Generate Draft" top-bar button (was placeholder in Slice 001). Draft pane shows generated sections with their headings and prose. Use the largest pane per PRD §UX (`prd/make ux wireframes.md`).
- **Auto-validate hook** — when the Checks panel toggle "Evaluate after every generation" (Slice 005) is ON, validation runs automatically after generation completes and the right rail updates.
- **Stubbed-model tests** per PRD §Testing Decisions — fast unit tests inject a deterministic stub at the model boundary; the test suite does NOT call a real LLM. A separate, smaller live-LLM smoke-test bucket can run on a schedule but is not gated on every commit.
- **Golden-output tests** per PRD §Further Notes "Risk: prompt drift" — a small number of golden-output tests on the Generation Engine catch silent quality regressions when prompts change.

This slice does **not** implement section rewrite, section expand, or section lock — those are Slice 007. It does **not** implement auto-fix or regenerate-failed-sections — those are Slice 008.

## Acceptance criteria

- [ ] Generation Engine module exposes the documented `generate(spec, outline, checks, options)` signature; callers never see prompt strings.
- [ ] Full-draft mode produces exactly one section per unlocked outline ID (verified with stubbed model).
- [ ] Generation never reads `Document.draftSections` as primary input in full-draft mode.
- [ ] Frozen outline test: generation against `outlineFrozen = true` returns sections matching the outline IDs exactly — no add, remove, or rename.
- [ ] Spec/outline immutability test: `Document.spec` and `Document.outline` are bit-identical after generation.
- [ ] `POST /generate` endpoint runs full-draft generation and persists `Document.draftSections`.
- [ ] "Generate Draft" button in the top bar triggers generation; the Draft pane renders the result.
- [ ] When "Evaluate after every generation" toggle is ON, the right rail updates with a fresh validation report after generation.
- [ ] Real LLM provider is wired in and configurable; tests use a stub, not the live provider.
- [ ] At least one golden-output test exists on the Generation Engine to catch prompt drift.

## Blocked by

- Blocked by `issues/003-spec-panel.md`
- Blocked by `issues/004-outline-panel.md`
- Blocked by `issues/005-checks-panel.md`

## User stories addressed

- User story 13 (generate full draft from Spec + Outline + Checks with one click)
- User story 40 (regeneration never silently changes Spec or Outline)
