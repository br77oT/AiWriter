// Template Library — bundles of { spec, outline, checks } that preload a new
// document. Per PRD §"Template Library":
//   "User-saved templates use the same shape" as built-ins.
// Both flow through the same TemplateBundle.

import type { Check, Document, OutlineSection, Spec } from "./types";
import { emptySpec } from "./types";

export interface TemplateBundle {
  spec: Spec;
  outline: OutlineSection[];
  checks: Check[];
}

export interface Template {
  id: string;
  name: string;
  builtIn: boolean;
  bundle: TemplateBundle;
}

// V1 template set per PRD §Further Notes "Open question":
// Incident Report + Postmortem + Status Report + Custom (blank).
export const BUILT_IN_TEMPLATES: Template[] = [
  {
    id: "incident-report",
    name: "Incident Report",
    builtIn: true,
    bundle: {
      spec: {
        goal:
          "Document the incident clearly so stakeholders understand what happened, why, and what's next.",
        tone: "neutral, factual",
        audience: "internal stakeholders and on-call team",
        mustInclude: [
          "timeline with timestamps",
          "named owners for follow-up actions",
        ],
        mustAvoid: ["speculation", "blame on individuals"],
      },
      outline: [
        { id: "summary", heading: "Summary", description: "One-paragraph recap of the incident.", required: true },
        { id: "timeline", heading: "Timeline", description: "Chronological events with timestamps.", required: true, format: "bullets" },
        { id: "root-cause", heading: "Root Cause", description: "What caused the incident.", required: true },
        { id: "impact", heading: "Impact", description: "Who was affected and how.", required: true },
        { id: "actions", heading: "Follow-up Actions", description: "Action items with owners and due dates.", required: true },
      ],
      checks: [
        { id: "c1", question: "What happened?" },
        { id: "c2", question: "When did it happen?" },
        { id: "c3", question: "Who was affected?" },
        { id: "c4", question: "What was the root cause?" },
        { id: "c5", question: "What corrective action was taken?" },
        { id: "c6", question: "What follow-up is still open?" },
      ],
    },
  },
  {
    id: "postmortem",
    name: "Postmortem",
    builtIn: true,
    bundle: {
      spec: {
        goal:
          "Explain what happened, what we learned, and how we'll prevent recurrence.",
        tone: "candid, blameless",
        audience: "engineering team and leadership",
        mustInclude: ["root cause analysis", "action items with owners"],
        mustAvoid: ["finger-pointing", "single-person blame"],
      },
      outline: [
        { id: "summary", heading: "Summary", description: "Brief recap of the event and outcome.", required: true },
        { id: "timeline", heading: "Timeline", description: "Sequence of events with timestamps.", required: true, format: "bullets" },
        { id: "root-cause", heading: "Root Cause", description: "Underlying cause analysis.", required: true },
        { id: "impact", heading: "Impact", description: "Scope and severity of the impact.", required: true },
        { id: "actions", heading: "Action Items", description: "Concrete follow-ups with owners.", required: true },
        { id: "lessons", heading: "Lessons Learned", description: "What we learned and what to change.", required: true },
      ],
      checks: [
        { id: "c1", question: "What happened?" },
        { id: "c2", question: "What was the root cause?" },
        { id: "c3", question: "How was the issue resolved?" },
        { id: "c4", question: "What action items are open?" },
        { id: "c5", question: "What did we learn?" },
      ],
    },
  },
  {
    id: "status-report",
    name: "Status Report",
    builtIn: true,
    bundle: {
      spec: {
        goal:
          "Communicate progress, risks, and next steps to stakeholders.",
        tone: "concise, actionable",
        audience: "managers and stakeholders",
        mustInclude: [
          "clear status indicator (on-track / at-risk / blocked)",
          "named owners for risks",
        ],
        mustAvoid: ["jargon", "vague status terms"],
      },
      outline: [
        { id: "headline", heading: "Headline status", description: "On-track, at-risk, or blocked — at a glance.", required: true },
        { id: "highlights", heading: "Highlights this period", description: "What got done.", required: true },
        { id: "risks", heading: "Risks", description: "Open risks with owners.", required: true },
        { id: "next-steps", heading: "Next steps", description: "What's planned next period.", required: true },
        { id: "asks", heading: "Asks", description: "What we need from stakeholders.", required: true },
      ],
      checks: [
        { id: "c1", question: "What is the current status?" },
        { id: "c2", question: "What progress was made this period?" },
        { id: "c3", question: "What are the active risks?" },
        { id: "c4", question: "What are the next steps?" },
        { id: "c5", question: "What do we need from stakeholders?" },
      ],
    },
  },
  {
    id: "custom",
    name: "Custom (blank)",
    builtIn: true,
    bundle: {
      spec: emptySpec(),
      outline: [],
      checks: [],
    },
  },
];

export function getBuiltInTemplate(id: string): Template | undefined {
  return BUILT_IN_TEMPLATES.find((t) => t.id === id);
}

// "Empty" for the purpose of the confirm-before-clobber prompt: nothing the
// user has invested time in. A title-only document still counts as empty —
// titles aren't editable in V1, so we don't gate on them.
export function isDocumentEmpty(doc: Document): boolean {
  const spec = doc.spec;
  const specEmpty =
    spec.goal === "" &&
    spec.tone === "" &&
    spec.audience === "" &&
    spec.mustInclude.length === 0 &&
    spec.mustAvoid.length === 0;
  const draftEmpty = Object.values(doc.draftSections).every(
    (text) => !text || text.trim() === ""
  );
  return (
    specEmpty &&
    doc.outline.length === 0 &&
    doc.checks.length === 0 &&
    draftEmpty
  );
}

// Apply a template to a document. Overwrites Spec / Outline / Checks; clears
// drafts, locks, freeze, and the templateId pointer is set to the new template.
// Versions are preserved (they are historical snapshots; PRD §Schema "Version"
// stores its own draftSections, so they remain coherent on their own).
export function applyTemplate(doc: Document, template: Template): Document {
  return {
    ...doc,
    templateId: template.id,
    spec: cloneSpec(template.bundle.spec),
    outline: template.bundle.outline.map((s) => ({ ...s })),
    checks: template.bundle.checks.map((c) => ({ ...c })),
    draftSections: {},
    lockedSectionIds: [],
    outlineFrozen: false,
  };
}

// Pull a TemplateBundle out of a document. Used by "Save as template": we
// snapshot exactly the three fields a template carries, no draft / locks /
// freeze state.
export function bundleFromDocument(doc: Document): TemplateBundle {
  return {
    spec: cloneSpec(doc.spec),
    outline: doc.outline.map((s) => ({ ...s })),
    checks: doc.checks.map((c) => ({ ...c })),
  };
}

function cloneSpec(spec: Spec): Spec {
  return {
    goal: spec.goal,
    tone: spec.tone,
    audience: spec.audience,
    mustInclude: [...spec.mustInclude],
    mustAvoid: [...spec.mustAvoid],
  };
}
