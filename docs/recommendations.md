# Recommendations — what to add next

A running list of suggestions for things worth adding to AiWriter, in
rough priority order. Each entry is concrete enough to scope on its own
without needing the conversation that produced it. Strike through or
remove entries as they ship.

## Worth shipping next

### 1. Stream Auto-fix progress

Same UX gap that Validate had until commit `c0c87c1`. Auto-fix internally
runs `validate()` and then N section rewrites; in local mode the route
goes silent for minutes with just a generic "running" indicator.

**Approach:** mirror the streaming refactor done in `/api/validate`.

- Refactor `/api/autofix/route.ts` to return a streaming NDJSON `Response`.
- Emit `check-start` / `check-done` for the planning validate pass.
- Emit `rewrite-start` / `rewrite-done` per section in the rewrite loop
  (one event per section, naming the section heading so the rail can
  display "Rewriting Impact (3 of 5)…").
- Final `done` event carries the same payload the route currently returns.
- Client consumer in `Workspace.handleAutofix` consumes the stream and
  pipes progress to a new `autofixProgress` prop on `ValidationRail`.

**Cost:** ~1 hour. Tests follow the validate stream test pattern.

### 2. Sidebar live-refresh on rename / delete

Today the sidebar's "Recent drafts" list only refetches `/api/documents`
when `activeDocumentId` changes. Renaming or deleting the current document
from the workspace leaves the sidebar showing the stale title (or the
deleted doc) until the user navigates.

**Options:**

- **Cheap:** refetch in Workspace's rename/delete handlers and pass an
  invalidation signal to Sidebar via a `refreshToken` prop.
- **Slightly bigger:** introduce a tiny in-process event bus or
  `useSyncExternalStore` so any mutation to `/api/documents` triggers
  any mounted Sidebar to refetch.

The cheap option is enough for now.

### 3. Per-section reviewer comments

Reviewer Mode today is read-only — the most common review action ("here's
what I think about this paragraph") has no home. Comments would turn the
share-link flow into something teams could actually use.

**Sketch:**

- Schema: `Document.comments: Array<{ id, outlineId, author, body, createdAt, resolved }>`.
- API: `POST/PUT/DELETE /api/documents/[id]/comments[/<commentId>]`.
- UI: a comment marker per section in the Draft pane; a dedicated
  comments rail or a popover anchored to the section.
- Reviewer Mode allows creating/replying/resolving; Author Mode shows
  the same surface plus the ability to delete.

**Cost:** moderate. Comments are the biggest collaboration win you can
ship without touching auth.

## Worth eventually

### 4. Diff view in the History panel

`src/lib/versions/index.ts` already exports a `diffVersions(a, b)` helper
that returns per-section added/removed/changed/unchanged. The
`VersionHistoryPanel` lists versions but never renders that diff. Add a
side-by-side per-section diff when the user clicks two versions, or a
unified diff against the previous one when the user clicks a single one.

### 5. Keyboard shortcuts

Muscle-memory actions for the most common operations:

- `g` — Generate Draft
- `v` — Validate
- `cmd/ctrl-s` — Save (currently a no-op; either implement Save or hide
  the button — see "cleanup" below)
- `?` — opens a shortcut cheatsheet modal

Light to add (a `useKeyDown` hook + a small modal). Skip on inputs.

## Cleanup before sharing

### 6. Replace the placeholder contact email

`src/components/AppFooter.tsx` ships with `mailto:hello@aiwriter.example`
in the Contact modal. Replace before sharing the app with anyone.

### 7. "Show footer" affordance

Hiding the AppFooter is permanent per browser — recovery requires
clearing localStorage. Pick one:

- Keep the copyright bar always-visible and only the About/Contact row
  hideable (closer to the pre-`3e42a5e` shape).
- Add a tiny "Show footer" link somewhere unobtrusive (e.g. the
  copyright text in the always-on bar becomes a button that brings
  About/Contact back).

### 8. Save button is a no-op

`TopBar`'s **Save** button currently has no `onClick` handler — it does
literally nothing. Either wire it (autosave is already in place via
`persistDocument`, so "Save" is mostly a placebo) or remove the button
to avoid the false affordance.

### 9. Mobile tab labels overflow

The longer pane titles ("Tone and Purpose", "Document Outline",
"Validation Checks") wrap onto a second line in the mobile tab bar at
narrow viewports. Either shorten the mobile-only label (e.g. "Tone",
"Outline", "Checks") or scroll the tab bar horizontally instead of
wrapping.
