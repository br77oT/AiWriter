# AiWriter

Structured AI drafting & review workspace. People who use chat-based AI tools to write long-form documents (incident reports, postmortems, status reports, proposals, PRDs) hit a recurring failure mode: fluent prose hides omissions. AiWriter separates a document into four layers — **Spec**, **Outline**, **Checks**, **Draft** — and runs a validation pass that reports both structural coverage (sections present?) and content coverage (questions answered?), with evidence quoted from the draft.

See `prd/PRD.md` for the full product spec.

## Status

Slice 001 — walking skeleton. The 5-pane workspace shell, document CRUD store + API, and baseline test infra are in place. Spec, Outline, Checks, Draft, and Validation panes ship as placeholders; later slices replace them.

## Tech stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Persistence | SQLite via `better-sqlite3` |
| Test runner | Vitest + jsdom + Testing Library |
| Styling | Tailwind CSS |
| LLM | stubbed interface in `src/lib/llm/`; real provider in slices 002 / 006 |

See `docs/decisions.md` for rationale.

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

Then open <http://localhost:3000>. On first run the app creates a blank document and lands you in the workspace; the document is persisted to `./data/aiwriter.db`. On reopen, the last-opened document loads automatically (per user story 36).

## Test

```bash
npm run test         # one-shot
npm run test:watch   # watch mode
```

The test suite covers one smoke test per layer (store, API, UI) plus the document round-trip case the rest of the slices will lean on.

## Typecheck

```bash
npm run typecheck
```

## Build

```bash
npm run build
npm start
```

## Layout

```
src/
  app/
    api/documents/        # POST list/create, GET/PUT by id
    documents/[id]/       # workspace page
    layout.tsx, page.tsx  # root: redirects to last-opened
  components/             # TopBar, Sidebar, Workspace, panes/*
  lib/
    types.ts              # Document schema (PRD §Schema)
    document-store.ts     # SQLite CRUD store
    llm/                  # model boundary stub
data/                     # SQLite db file (gitignored)
docs/decisions.md         # architectural decisions
issues/                   # tracer-bullet slices (PRD breakdown)
prd/                      # product spec + UX wireframes
```

## What the slice 001 walking skeleton proves

- Schema → store → API → UI → tests plumbing works end to end.
- Document CRUD round-trips through SQLite.
- The 5-pane workspace shell renders with text-labelled navigation.
- Last-opened document loads automatically on app start.
- `npm run test` and `npm run typecheck` both pass.
