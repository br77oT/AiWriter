## Parent PRD

`prd/PRD.md`

## What to build

The first vertical slice for a greenfield repo: choose the tech stack, scaffold the app, and ship a thin end-to-end walking skeleton through every layer (schema → store → API → UI → tests).

This slice does **not** implement Spec/Outline/Checks/Draft editing — those are later slices. It only proves the plumbing works: a user can create a Document, see it in the recent-drafts sidebar, and land in the 5-pane workspace shell with placeholder content in each pane.

Architectural decisions that need to be made and recorded here (this is why the slice is HITL):

- **Framework / runtime** — Next.js, plain Node + React + Vite, T3, Remix, etc. Recommend Next.js (App Router) for the single-app web target plus colocated API routes, but defer to user.
- **Persistence** — SQLite (e.g. better-sqlite3 or libsql), Postgres, or filesystem JSON. V1 has no auth so SQLite is sufficient.
- **LLM provider** — defer the model boundary to a stub interface in this slice; the real provider gets wired in Slice 002 (Validation) and Slice 006 (Generation). Per PRD §"Out-of-band decisions deferred", the provider is not pinned but the engine interface is.
- **Test runner** — Vitest, Jest, or Node's built-in test runner. Establish the pattern here since Slice 002 (Validation Engine) is the primary test target and needs the convention to be set.

The walking skeleton must include:

- Document schema per PRD §Schema, with `spec`, `outline[]`, `checks[]`, `draftSections{}`, `lockedSectionIds[]`, `outlineFrozen`, `versions[]` — all default-empty.
- Document CRUD store + API (create / get / list).
- 5-pane workspace shell layout per `prd/make ux wireframes.md` — left sidebar (documents/templates), Spec pane, Outline pane, Checks pane, Draft pane, right Validation rail. Each pane shows placeholder content with the panel name as a heading. Use **clear text labels in nav, not icon-only** (user story 35).
- "New document" button creates a blank Document via API and routes to it.
- Last-opened document loads automatically on app start (user story 36) — store last-opened ID in local persistence.
- Top bar with Logo, Template selector (placeholder dropdown), Save, Generate Draft (disabled placeholder), Validate (disabled placeholder), Export (disabled placeholder).
- Baseline test infra wired up with one passing test per layer (store, API route, UI smoke).
- README with run / test / build instructions.

## Acceptance criteria

- [ ] Tech stack decisions are recorded in a short `docs/decisions.md` (or equivalent) — framework, persistence, test runner, model boundary stub.
- [ ] `npm install` (or chosen equivalent) followed by the documented dev command starts the app locally.
- [ ] Document schema matches PRD §Schema; new documents are created with all fields default-empty.
- [ ] Recent-drafts sidebar lists existing documents and supports clicking to switch.
- [ ] "New document" button creates a Document and lands the user in the workspace.
- [ ] Workspace shell renders all five panes with placeholder content and clear text labels.
- [ ] Reopening the app routes to the last-opened document automatically.
- [ ] Test command runs and passes; one smoke test per layer (store, API, UI) exists.
- [ ] README documents install / dev / test / build commands.

## Blocked by

None — can start immediately.

## User stories addressed

- User story 14 (primary editor pane / workspace shell exists)
- User story 30 (browse recent drafts in left sidebar)
- User story 35 (clear text labels in navigation)
- User story 36 (last opened draft loads automatically)
