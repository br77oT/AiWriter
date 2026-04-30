// Dev-only fixtures so the right rail has something to render before the
// Spec/Outline/Checks editing panels exist (slices 003–005).

import type { Check, OutlineSection } from "../types";

export interface ValidationFixture {
  id: string;
  label: string;
  outline: OutlineSection[];
  checks: Check[];
  draftSections: Record<string, string>;
}

export const FIXTURES: ValidationFixture[] = [
  {
    id: "incident-with-gaps",
    label: "Incident report (with gaps)",
    outline: [
      { id: "summary", heading: "Summary", description: "", required: true },
      { id: "timeline", heading: "Timeline", description: "", required: true },
      {
        id: "root-cause",
        heading: "Root Cause",
        description: "",
        required: true,
      },
      { id: "impact", heading: "Impact", description: "", required: true },
      {
        id: "actions",
        heading: "Follow-up Actions",
        description: "",
        required: true,
      },
      { id: "appendix", heading: "Appendix", description: "", required: false },
    ],
    checks: [
      { id: "c1", question: "What happened?" },
      { id: "c2", question: "When did it happen?" },
      { id: "c3", question: "Who was affected?" },
      { id: "c4", question: "What was the root cause?" },
      { id: "c5", question: "What corrective action was taken?" },
      { id: "c6", question: "What follow-up is still open?" },
    ],
    draftSections: {
      summary:
        "At 14:32 on 2026-04-29 a smoke event triggered evacuation of the " +
        "main office. Building was clear within 12 minutes; no injuries " +
        "reported. Operations resumed at 15:45.",
      timeline:
        "14:32 smoke alarm triggered on floor 3. 14:34 evacuation announced. " +
        "14:46 all clear from fire department. 15:45 operations resumed.",
      "root-cause":
        "Initial inspection points to overheated transformer. Investigation " +
        "ongoing.",
      impact: "staff on floor 3",
    },
  },
  {
    id: "complete-postmortem",
    label: "Postmortem (mostly complete)",
    outline: [
      { id: "summary", heading: "Summary", description: "", required: true },
      { id: "timeline", heading: "Timeline", description: "", required: true },
      {
        id: "root-cause",
        heading: "Root Cause",
        description: "",
        required: true,
      },
      { id: "impact", heading: "Impact", description: "", required: true },
      { id: "actions", heading: "Action Items", description: "", required: true },
    ],
    checks: [
      { id: "c1", question: "What happened?" },
      { id: "c2", question: "What was the root cause?" },
      { id: "c3", question: "How was the issue resolved?" },
      { id: "c4", question: "What action items are open?" },
    ],
    draftSections: {
      summary:
        "Database connection pool exhausted during the 09:00 traffic spike, " +
        "causing 18 minutes of degraded service. Restored after raising the " +
        "pool size and restarting the affected nodes.",
      timeline:
        "09:00 traffic begins ramping. 09:04 connection pool saturated. " +
        "09:06 alerts page on-call. 09:14 root cause identified. " +
        "09:18 pool size raised and nodes restarted. 09:22 service nominal.",
      "root-cause":
        "Connection pool size was set to 25 — sized for last quarter's " +
        "traffic. Recent marketing campaign drove a 3x sustained spike that " +
        "exceeded the pool capacity.",
      impact:
        "About 8% of API requests returned 503 between 09:04 and 09:22. " +
        "Roughly 2,400 customers saw at least one failed request. No data " +
        "loss; affected requests were retried client-side.",
      actions:
        "1. Raise pool size to 100 across all regions (DONE). 2. Add a " +
        "load test gate to CI for the 09:00 spike profile (owner: alex, " +
        "due 2026-05-15). 3. Wire pool saturation to PagerDuty (owner: " +
        "jamie, due 2026-05-08).",
    },
  },
  {
    id: "blank",
    label: "Blank document",
    outline: [],
    checks: [],
    draftSections: {},
  },
];

export function getFixture(id: string): ValidationFixture | undefined {
  return FIXTURES.find((f) => f.id === id);
}
