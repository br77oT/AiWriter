## Updated product concept

The app is now a **structured AI drafting and review workspace** with four core layers:

- **Spec** — goals, tone, constraints, must-include and must-avoid rules.
- **Outline** — required sections and document structure.
- **Checks** — questions the final document must answer.
- **Draft** — the generated document.[^3][^2]

This is stronger than a normal AI writing tool because it separates **instructions**, **structure**, and **evaluation**, which aligns with modern PRD guidance that emphasizes acceptance criteria and review loops rather than just drafting.[^1][^3]

## Updated PRD wording

### Vision

The product helps users generate structurally reliable AI drafts that do not lose required sections or overlook critical questions during revision. It combines drafting with built-in validation so users can trust the output more than free-form chat tools.[^2][^1]

### Core user problem

Current chat-based writing tools can produce fluent drafts, but they often drop sections, miss constraints, and fail to answer all required business or compliance questions after multiple revisions. Acceptance criteria and structured evaluation are a proven way to reduce those gaps.[^2][^1]

### Product concept

A web app with a four-part workflow:

1. Write rules in the **Spec** panel.
2. Define structure in the **Outline** panel.
3. Add required questions in the **Checks** panel.
4. Generate and revise the **Draft**, then evaluate it against the checks.[^3][^1]

The product’s source of truth is **spec + outline + checks**, not the latest generated text.[^3]

## Updated MVP features

### 1. Structured drafting workspace

The app provides four persistent work areas: **Spec**, **Outline**, **Checks**, and **Draft**.  Users can move from planning to drafting without losing upstream decisions.[^1][^2][^3]

### 2. Review questions / checks

Users can enter a list of questions the document must answer, such as “What happened?”, “Who was affected?”, and “What follow-up is required?”.  These questions act as lightweight acceptance criteria for the document.[^4][^2][^1]

### 3. Automated draft evaluation

After generation, the app evaluates the draft against each question and returns a structured result such as **Answered**, **Partially answered**, or **Missing**, with supporting evidence from the document.  This turns the draft into something reviewable and measurable, not just readable.[^4][^2]

### 4. Structural validation

The app compares the generated draft against the outline and flags any missing required sections or headings.  This is separate from question coverage, so users can catch both structural and content-level failures.[^2][^1][^3]

### 5. Section-level revision

Users can regenerate or rewrite a specific section without changing the rest of the document.  This supports tighter control and reduces the “one fix breaks another section” problem common in generic chat interfaces.[^1][^3]

### 6. Templates

V1 includes templates for **incident reports** and **postmortems**, each with default outline sections and default review questions.  This gives users a faster starting point and reinforces structured usage.[^4][^3][^1]

## Updated UX model

A useful layout would be:

- Left rail: document type / template picker.
- Main workspace tabs or columns: **Spec**, **Outline**, **Checks**, **Draft**.
- Right-side results pane: **Validation** showing:
    - Missing sections.
    - Unanswered questions.
    - Suggested fixes.[^2][^1]

This reflects PRD and product-design guidance that acceptance criteria should be explicit, testable, and visible rather than buried in freeform notes.[^1]

## Updated success metrics

Add these to the PRD:

- **Question coverage rate**: percentage of required questions marked Answered on first draft.[^2]
- **Structural completeness rate**: percentage of required outline sections present in the draft.[^1][^2]
- **Revision reduction**: average number of edit cycles needed to reach reviewer approval.[^1]
- **User trust score**: percentage of users who say the app catches missing content better than general chat tools.[^2]


## Updated positioning

The product is no longer just an AI writer; it is an **AI drafting + document QA system**. That is a more defensible category because it focuses on **reliability and completeness**, not only text generation quality. Eval-driven AI product design increasingly treats the eval layer as part of the product definition itself, not an afterthought.[^4][^2]

## Concise PRD addition

You can paste this directly into the PRD:

**Review Questions / Acceptance Checks**
Users can define a list of questions the generated document must answer. After each draft is generated, the system evaluates the document against these questions and reports whether each is answered, partially answered, or missing, with supporting evidence and suggested fixes. This feature provides a lightweight eval framework for long-form drafting and helps prevent omissions that are difficult to catch in free-form chat workflows.[^4][^2][^1]

If you want, I can next turn this into a **clean one-page PRD** with sections like Problem, Users, Goals, Requirements, Non-goals, Metrics, and Open Questions.
<span style="display:none">[^10][^11][^12][^13][^14][^15][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>
 