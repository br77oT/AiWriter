## Parent PRD

`prd/PRD.md`

## What to build

Mobile-responsive layout per PRD user story 34 and `prd/make ux wireframes.md` "Mobile adaptation".

On screens below a chosen breakpoint (e.g. ~900px wide), the workspace collapses from five simultaneous panes into **tabs**:

- Spec
- Outline
- Checks
- Draft
- Validation

The desktop layout remains unchanged above the breakpoint. The left sidebar (documents/templates) becomes a slide-in drawer on mobile, accessible from a hamburger / labeled menu button (clear text label per user story 35 — no icon-only).

Per PRD §"Out of Scope" — this is responsive web only, not a native app.

Deliverables:

- Breakpoint-driven layout switch — desktop columns ⇄ mobile tabs.
- Tab bar showing the five pane labels with clear text (not icon-only).
- Sidebar drawer for documents/templates on mobile.
- Top bar adapts: condensed actions (Save / Generate / Validate / Export) remain reachable, with overflow menu if needed.
- Smoke tests at the documented mobile breakpoint and at desktop verifying both layouts render correctly.

## Acceptance criteria

- [ ] Below the breakpoint, the workspace renders as five tabs (Spec / Outline / Checks / Draft / Validation), one visible at a time.
- [ ] Above the breakpoint, the original five-pane desktop layout renders.
- [ ] Mobile sidebar drawer opens from a labeled menu button and lists documents and templates as on desktop.
- [ ] All top-bar actions (Save, Generate, Validate, Export, Template selector) remain reachable on mobile.
- [ ] All navigation uses clear text labels (per user story 35).
- [ ] Smoke tests render the workspace at a mobile and a desktop viewport and assert the correct layout for each.

## Blocked by

- Blocked by `issues/002-validation-engine-and-right-rail.md`
- Blocked by `issues/003-spec-panel.md`
- Blocked by `issues/004-outline-panel.md`
- Blocked by `issues/005-checks-panel.md`

## User stories addressed

- User story 34 (mobile workspace collapses into tabs: Spec, Outline, Checks, Draft, Validation)
