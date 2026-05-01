## Parent PRD

`prd/PRD.md`

## What to build

The Template Library module per PRD §"Template Library" — bundles of `{ spec defaults, outline, checks }` that preload a new document.

Per PRD §Further Notes "Open question" the recommended V1 set is **Incident Report**, **Postmortem**, **Status Report**, and **Custom (blank)**. Ship all four.

Deliverables:

- **Built-in templates** — three filled (Incident Report, Postmortem, Status Report) and one blank (Custom). Each filled template includes:
  - Default Spec fields (goal stub, tone hint, audience hint, sensible must-include / must-avoid starters).
  - Default Outline (e.g. for Incident Report: Summary, Timeline, Root Cause, Impact, Follow-up Actions — all Required) per the wireframe example.
  - Default Checks (e.g. "What happened?", "When did it happen?", "Who was affected?", "What was the root cause?", "What corrective action was taken?", "What follow-up is still open?").
- **Template selector** in the top bar (was placeholder in Slice 001) — picking a template on a new document preloads Spec, Outline, and Checks. Picking on an existing document is gated behind a confirm prompt to avoid clobbering.
- **User-saved templates** — "Save as template" action on the current document captures the current `{ spec, outline, checks }` as a reusable template with a user-supplied name. Saved templates appear in the sidebar under a "Templates" group and in the top-bar selector.
- **Wire up "Load template" in Checks panel** — the placeholder button from Slice 005 now opens the template picker for the current document type.
- **Template Library shape** — same `{ spec, outline, checks }` triple regardless of whether a template is built-in or user-saved (per PRD §"Template Library" → "User-saved templates use the same shape").

This slice does NOT implement the onboarding wizard — that's Slice 010. It only implements the template library and the in-app "pick a template" flow.

## Acceptance criteria

- [ ] All four V1 templates are present: Incident Report, Postmortem, Status Report, Custom (blank). Each filled template ships with Spec defaults + Outline + Checks.
- [ ] Selecting a template on a new document preloads Spec + Outline + Checks correctly.
- [ ] Selecting a template on an existing non-empty document prompts for confirmation before overwriting.
- [ ] "Save as template" captures the current document's `{ spec, outline, checks }`, prompts for a name, and persists.
- [ ] User-saved templates appear in the sidebar under "Templates" and in the top-bar selector.
- [ ] User-saved templates round-trip — saving and re-loading produces the original Spec/Outline/Checks bit-for-bit (verified by test).
- [ ] "Load template" in the Checks panel (Slice 005 placeholder) opens the template picker.
- [ ] Tests: each built-in template loads correctly; saved templates round-trip through the store.

## Blocked by

- Blocked by `issues/003-spec-panel.md`
- Blocked by `issues/004-outline-panel.md`
- Blocked by `issues/005-checks-panel.md`

## User stories addressed

- User story 9 (load default checks for the document type)
- User story 26 (choose a document type when starting)
- User story 27 (each template ships with default Outline and default Checks)
- User story 28 (Custom template option starts blank)
- User story 29 (save Spec + Outline + Checks bundle as reusable template)
