## Parent PRD

`prd/PRD.md`

## What to build

Export the final draft per PRD user story 33 — three formats minimum: **Markdown**, **plain text**, and **copy-to-clipboard**.

Plus enforcement of the "Block export if any check is missing" toggle from Slice 005 (PRD user story 12).

Deliverables:

- **Markdown export** — render the draft using outline headings as Markdown headings (per `Document.outline` order, skipping any sections with empty `draftSections[outlineId]`). Download as `.md`.
- **Plain text export** — same content stripped of Markdown syntax. Download as `.txt`.
- **Copy to clipboard** — Markdown form, single button.
- **Export button** in the top bar (was placeholder in Slice 001) — opens a small popover with the three options.
- **Block-if-missing enforcement** — when `Document.checks` has the "block export if any check is missing" toggle ON AND the latest validation report shows any check with status `missing` or `partial`, the export popover shows a blocking error listing the failing checks; both download options are disabled and copy-to-clipboard is disabled. Toggle OFF (or all checks `answered`) re-enables export.
- The current validation report is treated as the source of truth for the block check — if there's no recent report, run validation first (auto-validate before opening the popover).

## Acceptance criteria

- [ ] "Export" top-bar button opens a popover with three options: Download Markdown, Download Plain Text, Copy to Clipboard.
- [ ] Markdown export uses outline headings as Markdown headings in outline order; empty sections are skipped.
- [ ] Plain text export contains the same content stripped of Markdown syntax.
- [ ] Copy-to-clipboard copies the Markdown form.
- [ ] When "block export if any check is missing" is ON and any check is `missing` or `partial`, all three options are disabled and the failing checks are listed.
- [ ] Opening the export popover triggers validation if no current report exists.
- [ ] Tests: Markdown formatting is correct for outline+draft fixtures; plain text strips correctly; block-if-missing disables exports under the documented condition.

## Blocked by

- Blocked by `issues/002-validation-engine-and-right-rail.md`
- Blocked by `issues/005-checks-panel.md`

## User stories addressed

- User story 12 (block export if any check is missing — enforcement)
- User story 33 (export final draft as Markdown, plain text, copy-to-clipboard)
