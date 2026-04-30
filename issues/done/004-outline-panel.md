## Parent PRD

`prd/PRD.md`

## What to build

The Outline panel per PRD §"Outline Module" — a structured editor that replaces the placeholder Outline pane from Slice 001.

Per PRD §Schema, an OutlineSection is `{ id, heading, description, required, parentId? }`. Editor capabilities:

- Add / edit / remove sections.
- Mark sections **Required** or **Optional**. Required is the default for new sections.
- **Drag-and-drop reorder** — order is part of the persisted shape.
- Per-section short description field (visible in the editor; used as hints by Generation later).
- **Freeze outline** toggle. When `outlineFrozen = true`, the editor disables add/remove/rename and reorder. Section descriptions and required-flag remain editable (these don't change the section list itself).

Per PRD §"Architectural decisions" — "Frozen outline is hard. When frozen, generation cannot add, remove, or rename sections." This slice enforces the freeze in the **editor**; Slice 006 (Generation) enforces it server-side in the engine.

The outline must serialize to a stable form (PRD §"Outline Module") so later slices can pass it to Generation and Validation without ambiguity. Section IDs are stable across reorder.

## Acceptance criteria

- [ ] Outline pane lists current sections with heading, description, and a Required/Optional badge.
- [ ] Add section creates a new section with a stable ID, default Required, and persists.
- [ ] Edit and remove section persist correctly.
- [ ] Drag-and-drop reordering persists the new order; section IDs do not change on reorder.
- [ ] Freeze toggle disables add / remove / rename / reorder in the editor; description and required-flag remain editable.
- [ ] Switching documents loads the correct outline without bleed.
- [ ] Validation rail (from Slice 002) reflects outline changes — adding a required section that the draft lacks shows as `missing`, removing an outline section removes its row.
- [ ] Tests at the model layer cover: reorder preserves IDs and updates order; required-flag toggle round-trips; freeze blocks add/remove/rename/reorder; freeze allows description and required-flag edits.

## Blocked by

- Blocked by `issues/001-project-skeleton-and-walking-skeleton.md`

## User stories addressed

- User story 4 (structured outline with headings and subheadings)
- User story 5 (Required vs Optional section flag)
- User story 6 (drag-and-drop reorder)
- User story 7 (freeze outline before generation)
