// Seed the scenario gallery with a few named, ready-to-open links built from
// the dev fixtures. Run once after setup so `/scenarios` has real demo entries
// instead of being empty.
//
//   npm run seed:scenarios
//
// Idempotent: a fixture whose title is already present is skipped, so it is
// safe to re-run.

import { FIXTURES } from "../src/lib/validation/fixtures";
import { emptySpec, emptyChecksConfig } from "../src/lib/types";
import {
  getDefaultScenarioStore,
  type ScenarioSnapshot,
} from "../src/lib/scenario-store";

const store = getDefaultScenarioStore();
const alreadySeeded = new Set(store.list().map((s) => s.title));

let created = 0;
for (const fixture of FIXTURES) {
  // The "Blank document" fixture has no outline — a scenario from it has
  // nothing to generate or validate, so it is not worth seeding.
  if (fixture.outline.length === 0) {
    console.log(`skip "${fixture.label}" — empty fixture`);
    continue;
  }
  if (alreadySeeded.has(fixture.label)) {
    console.log(`skip "${fixture.label}" — already seeded`);
    continue;
  }

  const snapshot: ScenarioSnapshot = {
    title: fixture.label,
    spec: emptySpec(),
    outline: fixture.outline,
    checks: fixture.checks,
    checksConfig: emptyChecksConfig(),
    draftSections: fixture.draftSections,
    lockedSectionIds: [],
    outlineFrozen: false,
    templateId: null,
  };

  const { code } = store.create(snapshot);
  created += 1;
  console.log(`seeded "${fixture.label}" -> /scenario/${code}`);
}

console.log(`Done. ${created} scenario link(s) created.`);
