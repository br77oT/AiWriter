## Parent PRD

`prd/PRD.md`

## What to build

Extend the Generation Engine with section-level operations per PRD §"Section Rewrite Flow" and §"Generation Engine" rewrite/expand variants, plus the lock semantics from PRD §"Architectural decisions" → "Lock semantics are hard."

Deliverables:

- **Engine modes** — extend `generate()` (or add a sibling) with `rewrite` and `expand` modes that operate on a single outline ID. API: `POST /generate/section { documentId, outlineId, instruction?, mode: "rewrite"|"expand" } → SectionText`.
- **Section rewrite modal** per `prd/make ux wireframes.md` "Section rewrite modal":
  - Instruction textarea.
  - Preserve toggles (default all ON): heading text, factual claims already present, tone and style, do not edit other sections.
  - Cancel / Rewrite buttons.
- **Expand action** — short button on a section that opens the same modal preset for `expand` mode (preserve heading + existing facts; instruction adds depth).
- **Lock toggle** per section in the Draft pane. Locked section IDs are persisted in `Document.lockedSectionIds`.
- **Lock semantics**:
  - Full-draft regeneration (Slice 006) skips locked sections — locked content is bit-identical before and after. Update Slice 006's behavior here, with a regression test.
  - Rewriting one section never modifies sibling sections (locked or not).
  - The "preserve other sections" toggle in the rewrite modal must enforce no-sibling-edits even when `false` for non-target sections (i.e. the engine never returns sibling edits from a single-section call).
- **Tests** per PRD §Testing Decisions:
  - Rewrite-section mode does not modify sibling sections.
  - Expand-section mode preserves heading and existing factual claims.
  - Locked sections pass through unchanged on full-draft regeneration.
  - Lock toggle round-trips through the store.

## Acceptance criteria

- [ ] `POST /generate/section` with `mode: "rewrite"` returns text only for the target `outlineId`; sibling sections in `Document.draftSections` are untouched.
- [ ] `POST /generate/section` with `mode: "expand"` preserves the heading and existing factual claims while adding depth.
- [ ] Section rewrite modal renders with the four preserve toggles per the wireframe; the modal calls `/generate/section` with the correct mode and instruction.
- [ ] Per-section Lock toggle persists into `Document.lockedSectionIds`.
- [ ] Locked section regression test: run full-draft regeneration (Slice 006 path); locked section text is bit-identical before and after.
- [ ] Test: rewriting section A does not change section B's text.
- [ ] Test: expand mode preserves heading and prior factual claims (assertion against stubbed model output).

## Blocked by

- Blocked by `issues/006-generation-engine-full-draft.md`

## User stories addressed

- User story 15 (rewrite a single section without touching the rest)
- User story 16 (expand a section by giving a short instruction)
- User story 17 (lock a section after manual edit)
- User story 18 (rewrite modal with preserve toggles for heading, facts, tone, other sections)
