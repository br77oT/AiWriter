<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# make ux wireframes

Yes — below are low-fidelity UX wireframes for the app, centered on the idea that users define **rules**, **structure**, and **questions the document must answer**, then generate and validate a draft. Explicit checklists and visible sidebars are consistent with current UX guidance for reducing ambiguity and making criteria inspectable during editing.[^1][^2][^3]

## Workspace model

The product should revolve around a main drafting workspace with five persistent areas: **Spec**, **Outline**, **Checks**, **Draft**, and **Validation**. Document outline sidebars are a proven pattern for making structure visible during editing, and checklist-based interfaces work best when sections and questions are editable from one page.[^1][^4]

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ Top bar: Logo | Template: Incident Report ▼ | Save | Generate Draft | Validate | Export    │
├───────────────┬───────────────────────┬──────────────────────────────────────┬──────────────┤
│ Left sidebar  │ Center-left panel     │ Center-right panel                   │ Right rail   │
│               │                       │                                      │              │
│ Documents     │ SPEC                  │ DRAFT                                │ VALIDATION   │
│ - Draft 12    │ --------------------- │ -----------------------------------  │ ------------ │
│ - Draft 11    │ Goal: [textarea.....] │ [Generated document editor          ]│ Structure    │
│ - Template A  │ Tone: [textarea.....] │                                      │ ✓ Summary    │
│               │ Must include: [.....] │  H1 Incident Report                  │ ✓ Timeline   │
│ Templates     │ Must avoid: [......]  │  Summary                             │ ✗ Actions    │
│ - Incident    │ Audience: [........]  │  ...                                 │              │
│ - Postmortem  │                       │  Timeline                            │ Questions    │
│               │ OUTLINE               │  ...                                 │ ✓ What hap?  │
│               │ --------------------- │  Root Cause                          │ ~ Who hit?   │
│               │ [ ] Freeze outline    │  ...                                 │ ✗ Follow-up  │
│               │ 1. Summary            │                                      │              │
│               │ 2. Timeline           │ [Rewrite section] [Expand] [Lock]    │ Suggestions  │
│               │ 3. Root Cause         │                                      │ - Add open   │
│               │ 4. Impact             │                                      │   actions    │
│               │ 5. Follow-up Actions  │                                      │              │
│               │                       │                                      │              │
│               │ CHECKS                │                                      │              │
│               │ --------------------- │                                      │              │
│               │ - What happened?      │                                      │              │
│               │ - Who was affected?   │                                      │              │
│               │ - What action taken?  │                                      │              │
└───────────────┴───────────────────────┴──────────────────────────────────────┴──────────────┘
```


## Main screen

The main screen should make the app feel more like a **document system** than a chat app. Putting the draft in the largest pane and the validation results in a persistent right rail keeps the user’s attention on the document while still surfacing what is missing. Persistent labels in navigation are generally clearer than icon-only sidebars, especially for complex workspaces.[^2][^4]

### Key interactions

- User selects a template or opens a prior draft.
- User edits **Spec**, **Outline**, and **Checks** before generation.
- User clicks **Generate Draft**.
- Validation rail immediately shows structural gaps and unanswered questions.
- User revises one section at a time.


## Validation view

A dedicated validation state is important because the app’s differentiator is not just generation, but **coverage and completeness**. Checklist-based QA systems work best when every question is visible with status and evidence, not hidden behind a generic “looks good” score.[^5][^6][^7]

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│ VALIDATION                                                                   │
├───────────────────────────────────────────────────────────────────────────────┤
│ STRUCTURE                                                                    │
│ ✓ Summary                                                                    │
│ ✓ Timeline                                                                   │
│ ✓ Root Cause                                                                 │
│ ~ Impact (present but thin)                                                  │
│ ✗ Follow-up Actions missing                                                  │
│                                                                               │
│ DOCUMENT CHECKS                                                              │
│ 1. What happened?            ✓ Answered                                      │
│    Evidence: “At 14:32 a smoke event...”                                     │
│                                                                               │
│ 2. Who was affected?         ~ Partially answered                            │
│    Evidence: “staff on floor 3”                                              │
│    Suggestion: Add exact roles / departments impacted                        │
│                                                                               │
│ 3. What follow-up is open?    ✗ Missing                                      │
│    Suggestion: Insert unresolved action items and owners                     │
│                                                                               │
│ [Auto-fix missing items]   [Regenerate only failed sections]                 │
└───────────────────────────────────────────────────────────────────────────────┘
```


## Outline editor

The outline should be editable as a structured list rather than plain text, because headings are effectively part of the product’s constraint system. A visible outline panel also follows established editor patterns for navigating and maintaining section hierarchy.[^4]

```text
┌────────────────────────────────────────────┐
│ OUTLINE                                    │
├────────────────────────────────────────────┤
│ [ ] Freeze outline                         │
│                                            │
│ 1. Summary                      [Required] │
│    Short incident summary                  │
│                                            │
│ 2. Timeline                     [Required] │
│    Ordered sequence of events              │
│                                            │
│ 3. Root Cause                  [Required]  │
│                                            │
│ 4. Impact                      [Required]  │
│                                            │
│ 5. Follow-up Actions           [Required]  │
│                                            │
│ + Add section                              │
│ ↕ Drag to reorder                          │
└────────────────────────────────────────────┘
```


## Checks panel

This is the new differentiator: a textarea or list editor for questions the document must answer. It should support one question per line, quick status previews, and optional templates by document type. Checklist tools often use sectioned question editors because users think in prompts and inspection criteria, not in abstract “metrics.”[^1][^8]

```text
┌────────────────────────────────────────────┐
│ CHECKS                                     │
├────────────────────────────────────────────┤
│ Questions the document must answer         │
│                                            │
│ - What happened?                           │
│ - When did it happen?                      │
│ - Who was affected?                        │
│ - What was the root cause?                 │
│ - What corrective action was taken?        │
│ - What follow-up is still open?            │
│                                            │
│ [+ Add question]   [Load template]         │
│                                            │
│ Optional setting:                          │
│ [x] Evaluate after every generation        │
│ [x] Show evidence for each answer          │
│ [ ] Block export if any item is missing    │
└────────────────────────────────────────────┘
```


## First-run flow

Onboarding should ask for the document type first, then preload the outline and checks so the user experiences immediate structure. AI wireframing and UX tools increasingly emphasize guided flows that turn broad intent into concrete working screens faster than blank-canvas experiences.[^9][^10]

```text
Screen 1: Choose a document type
- Incident Report
- Postmortem
- Status Report
- Custom

Screen 2: Preload a starter system
- Outline template
- Default checks
- Tone/rules starter

Screen 3: Land in workspace
- Spec filled
- Outline filled
- Checks filled
- Ready to generate
```


## Section rewrite modal

Since users mainly struggle with later revisions breaking earlier content, section-level editing should be lightweight and constrained. A focused rewrite modal makes the action explicit: revise one part while preserving structure everywhere else.[^3]

```text
┌────────────────────────────────────────────────────┐
│ Rewrite section: Impact                            │
├────────────────────────────────────────────────────┤
│ Instruction                                        │
│ [Expand this section with operational impact and   │
│  mention which teams were blocked.]                │
│                                                    │
│ Preserve                                           │
│ [x] Heading text                                   │
│ [x] Factual claims already present                 │
│ [x] Tone and style                                 │
│ [x] Do not edit other sections                     │
│                                                    │
│ [Cancel]                          [Rewrite]        │
└────────────────────────────────────────────────────┘
```


## Mobile adaptation

On mobile, this should collapse into tabs rather than columns: **Spec**, **Outline**, **Checks**, **Draft**, **Validation**. Complex editing tools generally need progressive disclosure on smaller screens, because multiple simultaneous panes become unusable quickly.[^11]

## Recommended MVP screens

For a first prototype, I’d design just these four:

- **Onboarding / template selection**
- **Main drafting workspace**
- **Validation sidebar / results state**
- **Section rewrite modal**

Those four screens are enough to test the product’s core claim: “Can users create a reliable structured draft and detect omissions faster than in chat?”[^3][^5]

If you want, I can next turn these into:

- a cleaner **Mermaid wireflow diagram**, or
- a **real HTML mockup** you can click through.
<span style="display:none">[^12][^13][^14][^15][^16][^17][^18][^19]</span>

 