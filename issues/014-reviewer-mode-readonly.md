## Parent PRD

`prd/PRD.md`

## What to build

Read-only reviewer mode per PRD user story 39 — a way for a secondary actor to open a draft and judge completeness via the validation rail without being able to edit anything.

V1 has no auth (per PRD §"Out of Scope"), so reviewer mode is a per-document **view mode** toggle, not a permissions system. Two ways in:

- A "Reviewer mode" toggle in the top bar that flips the workspace to read-only for the current session.
- A URL parameter (e.g. `?mode=reviewer`) that opens a document directly in reviewer mode — useful for sharing a link.

In reviewer mode:

- Spec, Outline, Checks, and Draft panels render but all inputs are disabled.
- The right Validation rail remains fully visible (this is the entire point — a reviewer should see ✓/~/✗ statuses, evidence quotes, and suggested fixes).
- The top-bar Generate / Validate / Export / Save actions are disabled or hidden. Auto-fix and Regenerate-failed buttons in the rail are hidden.
- Version history is read-only — a reviewer can browse versions and view diffs but not Restore.
- Switching to a different document or leaving the page exits reviewer mode (the toggle does not persist across navigation).

## Acceptance criteria

- [ ] Top-bar "Reviewer mode" toggle flips the workspace to read-only.
- [ ] Opening a document with `?mode=reviewer` (or equivalent) lands directly in reviewer mode.
- [ ] In reviewer mode: Spec, Outline, Checks, Draft inputs are disabled; the Validation rail renders fully; top-bar mutating actions are disabled or hidden; in-rail Auto-fix and Regenerate-failed buttons are hidden.
- [ ] Version history is browsable in reviewer mode but Restore is hidden.
- [ ] Reviewer mode does not persist across navigation away from the document.
- [ ] Tests: reviewer mode renders correctly; mutating actions are disabled; URL param honors reviewer mode on load.

## Blocked by

- Blocked by `issues/002-validation-engine-and-right-rail.md`

## User stories addressed

- User story 39 (reviewer can open a draft and see the validation rail without editing)
