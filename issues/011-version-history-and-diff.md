## Parent PRD

`prd/PRD.md`

## What to build

Version history + diff view per PRD §Schema "Version" and §"Document Store" ("CRUD for drafts and versions; supports diff between versions").

A `Version` is `{ id, timestamp, draftSections, validationReport }`. A new version is created at:

- Every full-draft generation (Slice 006).
- Every section rewrite / expand (Slice 007).
- Every auto-fix / regenerate-failed run (Slice 008).
- Every on-demand "Validate" (Slice 002) — versioning includes the report so users can see how validation status moved over time.

Note: section-keyed draft storage means versions are cheap (only the changed sections need to differ); but for V1 it's acceptable to snapshot the full `draftSections` and `validationReport` on each version event. Optimize later if needed.

Deliverables:

- **Version-on-write** behavior in all the trigger points above.
- **Version history sidebar** — a per-document timeline of versions (timestamp + short label like "Generate", "Rewrite: Impact", "Validate", "Auto-fix"). Clicking a version opens a read-only view of that version's draft + validation report.
- **Diff view** — pick two versions, see a section-by-section diff highlighting added / removed / changed text. Markdown-aware diffing is sufficient (no rich-text); per-section so users can identify "the model dropped this paragraph in version 7."
- **"Restore this version"** action — copies the version's `draftSections` back into the live document and creates a new version recording the restore.

## Acceptance criteria

- [ ] Each generate, rewrite, expand, auto-fix, regenerate-failed, and on-demand validate creates a new `Version` with `{ timestamp, draftSections, validationReport }`.
- [ ] Version history UI lists versions newest-first with timestamp and event label.
- [ ] Clicking a version shows that version's draft + validation report read-only.
- [ ] Diff view between any two selected versions shows section-by-section changes (added / removed / changed).
- [ ] "Restore this version" replaces the live `draftSections` with the chosen version's content and records a new version.
- [ ] Tests: version creation on each trigger; diff correctly identifies added / removed / changed sections; restore round-trip leaves the live document equal to the restored version.

## Blocked by

- Blocked by `issues/006-generation-engine-full-draft.md`

## User stories addressed

- User story 31 (version history of a draft, recover lost content)
- User story 32 (diff view between draft versions)
