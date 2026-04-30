# PRD: Structured AI Drafting & Review Workspace

**Status:** needs-triage
**Source material:** `prd/yes.md`, `prd/make ux wireframes.md`, `prd/also i want to have a textarea where the user can.md`, `.old/brief.md`

## Problem Statement

People who use chat-based AI tools to write long-form documents (incident reports, postmortems, status reports, proposals, PRDs) repeatedly hit the same failure mode: fluent prose hides omissions. After a few rounds of revision the model silently drops a required section, contradicts an earlier constraint, or fails to answer a business-critical question. The user only finds out when a reviewer catches it — or worse, when nobody does.

The root cause is that chat tools optimize for conversational back-and-forth, not for document control. Intent, structure, and content all live in the same drifting transcript. There is no persistent source of truth, no acceptance criteria, and no built-in way to verify that the latest draft still meets the original requirements.

## Solution

A web app that separates a document into four explicit layers — **Spec**, **Outline**, **Checks**, **Draft** — and treats the first three as the source of truth. The user defines goals and rules (Spec), required sections (Outline), and required questions the document must answer (Checks) before generation. After each draft is produced, the app runs a **Validation** pass that reports both structural coverage (sections present?) and content coverage (questions answered?), with evidence quoted from the draft and suggested fixes for gaps.

The product promise: *plan once, draft reliably, revise surgically*. It is positioned not as another AI writer but as an AI drafting + document QA system, where the eval layer is part of the product, not an afterthought.

## User Stories

1. As a draft author, I want to write goals, tone, and constraints in a persistent Spec panel, so that they are not lost across revisions.
2. As a draft author, I want to list must-include rules and must-avoid phrases separately, so that the model treats them as hard constraints.
3. As a draft author, I want to specify the intended audience, so that tone and vocabulary are calibrated automatically.
4. As a draft author, I want to define a structured outline with headings and subheadings, so that the document has a stable skeleton.
5. As a draft author, I want to mark outline sections as Required vs. Optional, so that the validation step knows what is non-negotiable.
6. As a draft author, I want to reorder outline sections by drag-and-drop, so that I can iterate on structure quickly.
7. As a draft author, I want to freeze the outline before generation, so that subsequent rewrites cannot silently change the section list.
8. As a draft author, I want to add a list of questions the document must answer, so that I can encode coverage requirements that section headings cannot capture.
9. As a draft author, I want to load a default set of checks for the document type I selected, so that I am not starting from a blank list.
10. As a draft author, I want to add, edit, and remove individual check questions, so that I can tailor the rubric to the specific document.
11. As a draft author, I want to toggle "evaluate after every generation," so that I am not running validation manually each time.
12. As a draft author, I want to toggle "block export if any check is missing," so that I cannot accidentally ship an incomplete document.
13. As a draft author, I want to generate a full draft from Spec + Outline + Checks with one click, so that I get an initial document quickly.
14. As a draft author, I want to see the generated draft in a primary editor pane that takes the most screen space, so that I can read and edit comfortably.
15. As a draft author, I want to rewrite a single section without touching the rest, so that fixing one part does not break another.
16. As a draft author, I want to expand a section by giving a short instruction, so that I can add depth where the first draft was thin.
17. As a draft author, I want to lock a section after I have edited it manually, so that subsequent regenerations preserve my exact wording.
18. As a draft author, I want a rewrite modal that lets me preserve heading text, factual claims, tone, and other sections, so that the rewrite is constrained by default.
19. As a draft author, I want to see Validation results in a persistent right rail, so that I always know what is missing without leaving the editor.
20. As a draft author, I want Structure validation to show each required outline section as ✓ present, ~ thin, or ✗ missing, so that I can see structural gaps at a glance.
21. As a draft author, I want Question validation to show each check as Answered, Partially answered, or Missing, so that content coverage is visible per question.
22. As a draft author, I want each Answered/Partial check to show a short evidence quote from the draft, so that I can verify the evaluator's judgment.
23. As a draft author, I want each Missing or Partial check to show a suggested fix, so that I know what to add or revise.
24. As a draft author, I want an "Auto-fix missing items" button, so that I can regenerate only the gaps without rewriting the whole document.
25. As a draft author, I want a "Regenerate only failed sections" button, so that I can address structural gaps in one click.
26. As a draft author, I want to choose a document type (Incident Report, Postmortem, Status Report, Custom) when starting, so that I get a relevant preloaded template.
27. As a draft author, I want each template to ship with a default Outline and default Checks, so that I am productive within the first minute.
28. As a draft author, I want a "Custom" template option that starts blank, so that the product does not constrain me to predefined doc types.
29. As a draft author, I want to save my own Spec + Outline + Checks bundle as a reusable template, so that I can standardize my recurring document types.
30. As a draft author, I want to browse my recent drafts in a left sidebar, so that I can return to prior work without searching.
31. As a draft author, I want to see a version history of a draft, so that I can diff revisions and recover lost content.
32. As a draft author, I want a diff view between draft versions, so that I can see exactly when the model dropped or changed content.
33. As a draft author, I want to export the final draft (Markdown, plain text, copy-to-clipboard at minimum), so that I can move it into the system of record.
34. As a draft author on mobile, I want the workspace to collapse into tabs (Spec, Outline, Checks, Draft, Validation), so that the app remains usable on a small screen.
35. As a draft author, I want clear text labels in the navigation rather than icon-only buttons, so that the workspace is readable without tooltips.
36. As a returning user, I want my last opened draft to load automatically, so that I can resume work without navigating.
37. As a first-time user, I want a guided three-step onboarding (pick document type → review preloaded Outline/Checks → land in workspace ready to generate), so that I experience structure immediately rather than a blank canvas.
38. As a draft author, I want a "Validate" button that runs validation on demand, so that I can re-check after manual edits without regenerating.
39. As a reviewer (secondary actor), I want to open a draft and see the validation rail without editing, so that I can quickly judge completeness.
40. As a draft author, I want the app to never silently change the Spec or Outline during a draft regeneration, so that my source of truth stays intact.
41. As a draft author, I want validation results to update incrementally when I edit the draft text directly, so that I get fast feedback during manual editing.
42. As a draft author, I want to see a coverage score (e.g. "5/6 checks answered, 4/5 sections present"), so that I have a single completion signal.

## Implementation Decisions

### Module sketch

The product decomposes into the following modules. The aim is to keep the validation and generation layers as **deep modules** — small, stable interfaces wrapping rich behavior — so they can be tested in isolation from the UI.

- **Document Model** — the canonical structure: `{ spec, outline, checks, draft, versions }`. Spec is text fields. Outline is a tree of sections with `{ id, heading, description, required }`. Checks is a list of `{ id, question }`. Draft is structured (sections keyed to outline IDs) plus rendered prose.
- **Spec Module** — UI + persistence for goals, tone, audience, must-include, must-avoid.
- **Outline Module** — structured editor with reorder, required/optional flags, and a freeze toggle. Exposes a stable serialized form to the generator.
- **Checks Module** — list editor for review questions, with template loading and evaluation toggles.
- **Generation Engine** — deep module. Single interface: `generate(spec, outline, checks, options) → DraftSections`. Internally orchestrates LLM calls, section-level prompts, and "rewrite section" / "expand section" variants. Caller never touches prompt strings.
- **Validation Engine** — deep module. Single interface: `validate(draft, outline, checks) → ValidationReport`. Internally runs two evaluators:
  - **Structural Evaluator**: outline section → present / thin / missing in draft.
  - **Question Evaluator**: each check → answered / partial / missing, with evidence span and suggested fix.
- **Template Library** — bundles of `{ spec defaults, outline, checks }` for Incident Report, Postmortem, Status Report, Custom (blank). User-saved templates use the same shape.
- **Document Store** — CRUD for drafts and versions; supports diff between versions.
- **Workspace Shell** — the five-pane layout (Spec, Outline, Checks, Draft, Validation rail) plus the left sidebar for documents/templates.
- **Section Rewrite Flow** — modal-based; calls Generation Engine with a constrained prompt that preserves heading, facts, tone, and sibling sections.

### Deep-module rationale

`Generation Engine` and `Validation Engine` are the two interfaces that should not change as the UI evolves. They take simple inputs (the document model) and return simple structured outputs (sections, reports). Every UI affordance — Generate, Validate, Rewrite Section, Auto-fix, Regenerate Failed Sections — is a thin call into one of these two modules. This is the key architectural commitment.

### Architectural decisions

- **Spec + Outline + Checks is the source of truth, not the latest draft text.** Regeneration always reads from these; it never reads the previous draft as primary input (except for section-rewrite flows that explicitly preserve content).
- **Section-keyed draft.** The draft is stored as sections mapped to outline IDs, not as a single blob. This is what makes section-level rewrite, lock, and structural validation reliable.
- **Validation is deterministic from the draft.** Given the same draft + outline + checks, validation should produce a stable report. Re-running without changes should not flip statuses.
- **Two-layer validation.** Structural and question coverage are separate concerns and rendered separately in the UI. A draft can have all sections and still fail checks, or vice versa.
- **Evidence is required.** Any "Answered" or "Partial" status must include a quoted span from the draft. No black-box scores.
- **Lock semantics are hard.** A locked section is never modified by full-draft regeneration or by rewrites of other sections.
- **Frozen outline is hard.** When frozen, generation cannot add, remove, or rename sections.

### Schema (logical, not bound to a specific store)

- `Document { id, templateId?, spec, outline[], checks[], draftSections{outlineId → text}, lockedSectionIds[], outlineFrozen, versions[] }`
- `OutlineSection { id, heading, description, required, parentId? }`
- `Check { id, question }`
- `ValidationReport { structure: [{ outlineId, status, note? }], questions: [{ checkId, status, evidence?, suggestion? }], coverageScore }`
- `Version { id, timestamp, draftSections, validationReport }`

### API contracts (logical)

- `POST /generate { documentId } → DraftSections` — generates all unlocked sections.
- `POST /generate/section { documentId, outlineId, instruction?, mode: "rewrite"|"expand" } → SectionText`
- `POST /validate { documentId } → ValidationReport`
- `POST /autofix { documentId } → DraftSections` — regenerates only sections/checks marked failing.
- Template, document, and version endpoints follow standard CRUD.

### Out-of-band decisions deferred

- LLM provider/model choice is not pinned in this PRD; the Generation Engine interface is what's stable.
- Auth and multi-user collaboration are out of scope for V1 (see Out of Scope).

## Testing Decisions

### What makes a good test here

Tests target **external behavior of the deep modules**, not their internal prompt strings, internal LLM call counts, or UI implementation details. A good test answers a question a user would care about: "given this Spec/Outline/Checks/Draft, does Validation report what it should?" or "given a frozen outline, does Generation refuse to add sections?"

LLM-backed modules are tested with deterministic stubs at the model boundary so the test suite is fast and stable. A separate, smaller suite of live-LLM smoke tests runs against real models on a schedule, not on every commit.

### Modules to test

- **Validation Engine** — primary test target. Highest leverage because:
  - it is pure-function shaped (`(draft, outline, checks) → report`),
  - it encodes the product's core differentiator,
  - regressions here are silent (a wrong status looks like a correct status).
  Test cases: every check status (answered / partial / missing) with evidence presence; every structural status (present / thin / missing); coverage score arithmetic; stability across re-runs on identical input; behavior on empty draft, empty checks, empty outline.

- **Generation Engine** — tested with a stubbed model. Verify: full-draft mode produces one section per unlocked outline ID; locked sections are passed through unchanged; frozen outline is respected (no new/renamed sections); rewrite-section mode does not modify sibling sections; expand-section mode preserves heading and existing facts.

- **Document Model + Store** — version creation, diff between versions, lock/unlock semantics, freeze/unfreeze semantics.

- **Template Library** — loading a template populates Spec + Outline + Checks correctly; saving a custom template round-trips.

- **Outline editor logic** (reorder, required-flag toggle, freeze) — unit-tested at the model layer, separately from the UI.

UI components (panels, modal, validation rail rendering) get a thin layer of integration tests for the critical flows: generate → validate → see report; rewrite section → other sections unchanged; freeze outline → regenerate → section list identical. They do not get exhaustive component tests.

### Prior art

There is no prior code in this repo (greenfield project — only `startClaude.sh` and the `prd/` directory exist). Test conventions will be established by the first module landed; the Validation Engine should land first and set the pattern, since it is the most test-friendly shape.

## Out of Scope

- Real-time multi-user collaboration, comments, suggesting/track-changes mode.
- Authentication, accounts, billing, team workspaces.
- Rich-text WYSIWYG editing — V1 uses Markdown-shaped editing.
- Image generation, embedded images, file attachments inside drafts.
- Integrations with external systems (Jira, Linear, Notion, Google Docs, Slack export).
- Fine-tuned or self-hosted model training.
- Localization / non-English drafting (V1 is English-only).
- Compliance certifications (SOC 2, HIPAA, etc.) — deferred until product-market fit.
- Retrieval over the user's own corpus of past documents (RAG) — interesting follow-up, not V1.
- Mobile-native apps — V1 is responsive web only, with mobile collapsing to tabs.
- A11y beyond basic keyboard navigation and semantic markup — full WCAG audit deferred.

## Further Notes

- **Positioning lever.** The "AI drafting + document QA" framing is the differentiator vs. ChatGPT/Claude/Gemini chat. Marketing and onboarding copy should consistently reinforce that the eval layer is the product, not a feature.
- **Success metrics to instrument from V1.**
  - *Question coverage rate*: % of checks marked Answered on first draft.
  - *Structural completeness rate*: % of required outline sections present on first draft.
  - *Revision reduction*: median number of regenerate/rewrite cycles to a state where validation is all-green.
  - *Trust score*: short in-app survey — "Does this app catch missing content better than chat tools you've used?"
- **Recommended MVP screens** (per `prd/make ux wireframes.md`): onboarding/template selection, main drafting workspace, validation results state, section rewrite modal. Anything beyond these is V2.
- **Risk: evaluator quality.** Question Evaluator accuracy is the load-bearing claim of the product. If it produces false-positive "Answered" results, trust collapses. Worth investing in: a small labeled set of (draft, question) → expected status pairs to track Evaluator accuracy across model/prompt changes.
- **Risk: prompt drift across updates.** Because Generation Engine is a deep module, all prompt evolution lives behind one interface. This is intentional — but it also means we need golden-output tests on the Generation Engine to catch silent quality regressions when prompts change.
- **Open question for the user:** which document types beyond Incident Report and Postmortem ship in V1? `prd/yes.md` mentions Status Report; the wireframes also include it. Recommend V1 = Incident Report + Postmortem + Status Report + Custom (blank).
- **No issue tracker is configured for this project.** This PRD is checked in as `prd/PRD.md` rather than published. When a tracker is set up, this file should be migrated and tagged `needs-triage`.
