# AiWriter

A web app that turns a Spec + Outline + Checks into a structured AI-drafted
document the user keeps control over. Sections are written one at a time by
an LLM, then graded against the user's checks.

## Language

**Document**:
The unit the user works on — a single piece of writing in progress.
Composed of a **Spec**, an **Outline**, **Checks**, and per-section draft
text.

**Spec**:
The "why" of a Document — goal, tone, audience, must-include items,
must-avoid items. Persisted on `Document.spec`. Edited in the **Spec
pane** (labeled "Tone and Purpose" in the UI).
_Avoid_: brief, requirements doc.

**Outline**:
The ordered list of **Sections** the Document will be made of. Edited in
the **Document Outline pane**. Sections are stable (each has a sticky `id`).

**Section**:
A single entry in the Outline — heading + optional description + a
required-vs-optional flag + an optional format (prose / bullets /
numbered). The same Section is rendered as a **Prompt** in the Draft pane.
_Avoid_: chapter, block.

**Prompt** (UI term, Draft pane only):
A Section as displayed in the Draft pane: heading on top, draft text in a
textarea below. The Draft pane copy calls these "numbered prompts". A
**Prompt** is not "the LLM prompt" — that's a separate thing only the
Prompt Inspector exposes.
_Avoid_: LLM prompt (different thing), question.

**Required prompt** / **Required section**:
A Section whose `required: true` flag is set. As of the new Generate gate:
"filled in" means **both** the heading is non-empty AND the draft textarea
has user-provided text. An empty draft textarea on a required section
blocks Generate Draft.
_Avoid_: mandatory.

**Check**:
A question the finished Document must answer (e.g., "What was the root
cause?"). Edited in the **Validation Checks pane**. Each check runs as one
LLM call during Validate.
_Avoid_: rule, assertion, test.

**Draft text**:
The prose for a single Section, stored on `Document.draftSections[sectionId]`.
Filled in by the user, by Generate Draft, by Rewrite/Expand, or by
Auto-fix.

**Generated draft** (UI term):
The read-only stitched view of the Document — every Section's heading
followed by its Draft text, top to bottom. Rendered by the Generated draft
pane (component file: `AssembledDraftPane.tsx`).
_Avoid_: assembled draft (legacy term — internal id is still `assembled`).

**Locked Section**:
A Section the user has pinned: Generate Draft and Auto-fix skip it
bit-identically. Tracked on `Document.lockedSectionIds`.

**Validation Report**:
The output of one Validate run — a per-Section structural status plus a
per-Check answered/partial/missing/error verdict, plus a coverage score.
Snapshotted into a `Version`.

**Version**:
A frozen snapshot of the Document, recorded automatically after every
Generate / Validate / Rewrite / Auto-fix. Stored on `Document.versions[]`
with timing + token usage metrics.

**Reviewer mode**:
A read-only mode triggered by `?mode=reviewer` in the URL. Hides
mutating actions; keeps navigation + History.

## Relationships

- A **Document** has one **Spec**, one **Outline**, and a list of **Checks**.
- The **Outline** is a list of **Sections** in order.
- Each **Section** has zero or one **Draft text** entry (keyed by section id).
- Each **Section** can be **locked**, in which case Generate / Auto-fix skip it.
- Each **Check** maps to one entry in a **Validation Report**'s `questions[]`.
- Every Generate / Validate / Rewrite / Auto-fix run produces one **Version**.

## Flagged ambiguities

- **"prompt"** was being used to mean (a) a Section as shown in the Draft
  pane and (b) the LLM prompt text sent on the wire. Resolved: in the
  product UI it always means (a). The wire-level prompt is "LLM prompt"
  and is only visible via the Prompts panel.
- **"required prompt is empty"** was ambiguous between "heading empty",
  "description empty", and "textarea empty". Resolved: for blocking
  Generate, "filled in" means **heading non-empty AND textarea
  non-empty**.
- **"assembled draft" / "structured draft" / "generated draft"** all
  referred to the same read-only stitched view. Resolved: user-facing
  term is **Generated draft**. Internal id stays `assembled` for
  compatibility.

## Example dialogue

> **Dev:** "Generate fired even though the user hadn't filled in a Required
> prompt — that should be blocked."
> **Designer:** "Right. 'Filled in' means the **Section** has a heading
> AND the **Draft text** for that section is non-empty. Heading-only isn't
> enough."
> **Dev:** "What if the section is locked?"
> **Designer:** "Locked **Sections** are skipped by Generate entirely — they
> don't gate it. Required+locked+empty is effectively a no-op for Generate."
