# Architectural decisions

Recorded as part of slice 001 (project skeleton). Each decision lists the choice, the alternatives considered, and the reason. Revisit when a constraint changes — don't churn.

## Framework / runtime — Next.js 15 (App Router)

- **Choice:** Next.js 15 with the App Router, running on Node 20+.
- **Alternatives considered:** plain Node + React + Vite, Remix, T3 (create-t3-app).
- **Why:** the product is a single-app web target with first-party API routes (`/api/documents`, `/api/validate`, `/api/generate`, etc.). Next.js colocates API and UI without a separate server, has a stable file-based routing convention the AFK queue can extend mechanically, and ships React Server Components for cheap server-side reads of documents.
- **Implications:** API routes live under `src/app/api/...`; pages under `src/app/...`. Server-only code (the SQLite store, the model boundary) stays out of client bundles by being imported only from server components and route handlers.

## Persistence — SQLite via `better-sqlite3`

- **Choice:** SQLite, accessed synchronously through `better-sqlite3`. One database file per local install.
- **Alternatives considered:** libsql, Postgres, filesystem JSON.
- **Why:** V1 has no auth and runs single-user (PRD §"Out of Scope"). SQLite is zero-ops, atomic, and small. `better-sqlite3` is synchronous, which matches Next.js route handlers cleanly without async pool plumbing. Filesystem JSON was tempting but version history (slice 011) and diff queries are cheaper to implement against a real query engine.
- **Implications:** documents are serialized as JSON in a single column for V1 — the structured fields (`spec`, `outline[]`, `checks[]`, `draftSections{}`, etc.) round-trip through `JSON.stringify` / `JSON.parse`. If a slice needs to query *into* the JSON (e.g. "documents with at least one missing check"), revisit and add columns or a JSON1 query then. Don't normalize prematurely.
- **Native module note:** `better-sqlite3` is a native binding. If `NODE_MODULE_VERSION` errors appear after a Node upgrade, run `npm rebuild better-sqlite3` (or use the `better-sqlite3-rebuild` skill).

## Test runner — Vitest

- **Choice:** Vitest, with `jsdom` for component tests and React Testing Library for assertions.
- **Alternatives considered:** Jest, `node:test`.
- **Why:** Vitest is the most common 2026 default for TS + React projects, has fast watch mode, native ESM support, and a Jest-compatible API. The Validation Engine (slice 002) will be the primary test target — pure-function shape, deterministic stubs at the model boundary — and Vitest's ergonomics for that kind of input/output testing are excellent.
- **Convention:** colocate tests next to the code they test (`document-store.ts` next to `document-store.test.ts`). The slice-002 Validation Engine will set the deeper pattern for engine-level tests.

## LLM provider — stub interface in V1, Anthropic-shaped target

- **Choice:** the model boundary is a small interface in `src/lib/llm/`. V1 ships a deterministic stub. Slices 002 (Validation) and 006 (Generation) will swap in a real provider behind the same interface.
- **Target provider:** Anthropic (Claude). The interface is shaped to match the Messages API — `(systemPrompt, messages) → text` — but is provider-neutral enough that swapping to another provider is one file.
- **Why:** the PRD pins the *engine interface*, not the provider (PRD §"Out-of-band decisions deferred"). Stubbing here lets the Validation and Generation engines be developed and tested without live LLM calls (PRD §Testing Decisions: "deterministic stubs at the model boundary").

## Language, package manager, styling — TypeScript, npm, Tailwind

- **TypeScript** for type safety across the document schema (the schema is the spine of the product; typos in field names cost more than they save).
- **npm** as package manager — matches the AFK runner script (`npm run test`, `npm run typecheck`).
- **Tailwind CSS** for utility-first styling — fast to iterate on, no custom design system to maintain in V1.
