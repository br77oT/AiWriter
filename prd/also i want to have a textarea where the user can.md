# also i want to have a textarea where the user can have a list of questions that the document must answer .... like a mini evaluation on the document

Yes — that’s a strong idea, and it should probably be a **first-class feature**, not just another prompt field. Predefined evaluation criteria help reviewers catch what is *missing*, not just what sounds good, which is especially valuable for AI-generated drafts where fluent prose can hide omissions.[^1][^2]

## What it is

Add a fourth input area called something like **Review Questions**, **Document Checks**, or **Acceptance Criteria**. The user writes questions the finished document must answer, and the app evaluates the draft against them after generation.[^3][^2]

Example:

- What happened?
- When did it happen?
- Who was affected?
- What was the root cause?
- What corrective action was taken?
- What follow-up is still open?

That effectively turns the document into a mini eval target, which aligns with checklist-based QA workflows where the system runs a set of prompts and returns structured pass/fail plus reasoning.[^4][^3]

## Why it matters

This solves a different problem than the outline:

- **Outline** checks structure: are the required sections present?[^2]
- **Review questions** check coverage: does the document actually answer the important questions?[^1][^2]

That distinction is valuable because a draft can contain all headings and still fail to answer the critical business questions. Predefined rubrics and checklists are often used precisely to detect those hidden gaps.[^2][^1]

## How it should work

After draft generation, the app should run an evaluation pass:

1. Read the draft.
2. For each question, decide:
    - Answered
    - Partially answered
    - Not answered
3. Show evidence from the draft and optionally suggest a fix.[^3][^2]

So the UI could show:


| Question | Status | Evidence | Fix |
| :-- | :-- | :-- | :-- |
| What happened? | Answered | “A chemical spill occurred…” | — |
| Who was affected? | Partial | Mentions staff but not names/roles | Add impacted parties |
| What follow-up is open? | Missing | No unresolved actions section | Insert follow-up actions |

That maps well to structured evaluation outputs used in checklist-driven AI QA systems.[^3]

## Good UX shape

I’d make it a dedicated panel or tab in the workspace:

- **Spec** – goals, tone, constraints
- **Outline** – required sections
- **Checks** – questions the document must answer
- **Draft** – generated output
- **Eval Results** – pass/partial/fail against the checks

The nice thing is that this makes the app feel less like “AI writing” and more like **AI drafting with built-in review**. That is a much stronger product story.[^2][^3]

## Suggested PRD wording

You can add this to the feature section:

**Acceptance Criteria / Review Questions**
Users can enter a list of required questions the document must answer. After generation, the system evaluates the draft against each question and returns a structured result: answered, partially answered, or missing, with supporting evidence and suggested fixes. This feature acts as a lightweight built-in document eval layer to improve completeness and reduce review time.[^3][^2]

## My recommendation

I’d treat this as one of the core differentiators of V1, because it turns the app from “better prompt UI” into “structured drafting + quality assurance.” Checklist/rubric-based evaluation is already proving useful in AI-assisted document workflows because it makes missing information visible before a human reviewer has to catch it manually.[^1][^2][^3]

If you want, I can now rewrite your PRD outline to include this feature cleanly and adjust the MVP accordingly.
<span style="display:none">[^10][^11][^12][^13][^14][^15][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>
 