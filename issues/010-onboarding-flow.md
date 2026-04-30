## Parent PRD

`prd/PRD.md`

## What to build

The first-run guided onboarding per `prd/make ux wireframes.md` "First-run flow" — a three-step wizard that turns broad intent into a populated workspace before the user faces a blank canvas.

Steps:

1. **Choose a document type** — Incident Report / Postmortem / Status Report / Custom.
2. **Review preloaded starter** — show the Outline + Checks that will be loaded (read-only preview); user can confirm or go back.
3. **Land in workspace** — Spec / Outline / Checks are populated; user is on a fresh document, ready to click Generate.

Triggering rules:

- Onboarding shows automatically when the user has zero documents (first-run state).
- A "New document" action also routes through the onboarding flow rather than dumping the user on a blank workspace. The "Custom" choice creates a blank document immediately, skipping step 2.

Per PRD §Further Notes — the goal is "structure immediately rather than a blank canvas." Don't make this skippable in a way that lands the user on Custom by accident.

## Acceptance criteria

- [ ] First-run state (no documents) routes to the onboarding wizard automatically.
- [ ] "New document" action goes through the wizard, not directly to a blank workspace.
- [ ] Step 1 lists the four document types; selecting any of the three filled types proceeds to step 2.
- [ ] Step 1 "Custom" selection skips step 2 and creates a blank document.
- [ ] Step 2 shows a read-only preview of the outline and checks for the chosen template; user can go back or confirm.
- [ ] Step 3 lands the user in the workspace with Spec / Outline / Checks preloaded from the chosen template.
- [ ] Tests: each path (three filled templates + custom + first-run) lands in the correct workspace state.

## Blocked by

- Blocked by `issues/009-template-library.md`

## User stories addressed

- User story 37 (guided three-step onboarding: pick type → review preloaded → land ready to generate)
