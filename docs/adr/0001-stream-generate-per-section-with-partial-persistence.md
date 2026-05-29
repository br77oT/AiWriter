# Stream Generate per-section with partial persistence

`/api/generate` is currently a one-shot endpoint: the server writes every
non-locked section sequentially (one LLM call per section), then returns the
whole document. On a typical 5-section doc this is ~10–30s of staring at a
static screen with no signal what's happening. We will refactor it to mirror
the streaming pattern already proven by `/api/validate`:

- **NDJSON event stream** with `section-start` / `section-done` /
  `section-error` / `done` events, one event per outline section. Locked
  sections are emitted as gray "Locked — kept" rows in the checklist,
  honest about doc structure rather than hidden.
- **Per-section persistence.** After each successful `section-done`, the
  section text is written to `Document.draftSections` immediately. The
  per-run `Version` snapshot is still recorded once, at the end of the
  run (or at cancel / final failure).
- **Continue-on-failure.** A single section's LLM call throwing emits a
  `section-error` event but does not abort the run — siblings still
  process. The user fixes the failed one with Rewrite/Expand rather than
  re-running the whole Generate.
- **Client-side cancel.** The client uses an `AbortController` to stop
  reading the stream. The in-flight LLM request for the section currently
  being written still completes server-side (an HTTP abort doesn't kill
  the Promise), but no further sections start. Already-persisted sections
  stay on disk.
- **Inline UI fill.** The Draft pane's section textareas fill in place
  as their `section-done` events arrive. All textareas are locked
  (`disabled`) for the duration of the run. A "Generating: N of M" line
  near the top Generate Draft button gives an at-a-glance count and hosts
  the Cancel button.
- **Validate stays separate.** When `evaluateAfterEveryGeneration` is on,
  Workspace fires its own Validate stream after Generate's `done` arrives.
  Validate already has live UI in the Validation rail; we don't merge
  routes.

## Why this shape

Validate already streams NDJSON with this event vocabulary; reusing the
shape keeps the client consumer pattern identical (the buffer + split-on-`\n`
+ JSON.parse loop in `Workspace.runValidate`). The novel pieces vs.
Validate are partial-persistence and continue-on-error — both consequences
of Generate's per-section calls producing user-visible content (vs.
Validate's per-check verdicts, which are aggregated into one report).

## Considered alternatives

- **Coarse "phase" checklist** (Reading spec → Calling LLM → Saving). Most
  of the wall time is inside one phase, so this is a fake spinner.
  Rejected.
- **Token-level streaming inside each section.** Visually flashy but
  requires Anthropic streaming API + provider-abstraction changes + a
  cursor-management story. Rejected for V1; per-section granularity is
  already 5–10× more frequent feedback than today.
- **All-or-nothing persistence with rollback on cancel.** Hides partial
  progress from disk; would lie about what the user can see in the
  textareas. Rejected.
- **Single combined Generate+Validate stream.** Coupling two endpoints
  that have well-defined separate UIs. Rejected.

## Consequences

- The event contract becomes part of the client API surface. Adding new
  event types is forward-compatible; renaming or removing them is not.
- A long doc that succeeds halfway and then has its server crash leaves
  `draftSections` partially populated. This is intentional — the user can
  see what made it and Rewrite the rest — but means History versions are
  the only point-in-time rollback. Existing version-restore covers this.
- `durationMs` + token usage on the per-run Version stay aggregate (the
  whole run), not per-section.
