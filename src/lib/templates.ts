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

// Built-in template set. V1 shipped four (Incident Report, Postmortem,
// Status Report, Custom); the planning/business types below were added on
// top once the four core retrospective shapes proved out. Custom stays last
// so the picker reads "or start blank".
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
    id: "business-plan",
    name: "Business Plan",
    builtIn: true,
    bundle: {
      spec: {
        goal:
          "Lay out the business — what it does, who it serves, how it makes money, and what it needs to succeed.",
        tone: "confident, specific",
        audience: "investors, partners, internal stakeholders",
        mustInclude: ["addressable market sizing", "named competitors"],
        mustAvoid: ["unsupported projections", "buzzword filler"],
      },
      outline: [
        { id: "summary", heading: "Executive Summary", description: "One-page recap of the business and the ask.", required: true },
        { id: "problem", heading: "Problem & Opportunity", description: "The pain being solved and why it matters.", required: true },
        { id: "solution", heading: "Solution", description: "The product or service and what makes it different.", required: true },
        { id: "market", heading: "Market & Customer", description: "Target customer, segments, and size of the opportunity.", required: true },
        { id: "competition", heading: "Competition", description: "Who else does this and how this is differentiated.", required: true },
        { id: "model", heading: "Business Model", description: "How the business makes money — pricing, channels, unit economics.", required: true },
        { id: "gtm", heading: "Go-to-market", description: "How customers will be acquired in the first 12 months.", required: true },
        { id: "team", heading: "Team", description: "Who is doing this and why they are the right people.", required: true },
        { id: "financials", heading: "Financials", description: "High-level revenue, cost, and runway projections.", required: true, format: "bullets" },
        { id: "ask", heading: "Milestones & Ask", description: "Dated milestones and what is being requested (funding, hires, partners).", required: true, format: "bullets" },
      ],
      checks: [
        { id: "c1", question: "What problem does the business solve?" },
        { id: "c2", question: "Who is the target customer?" },
        { id: "c3", question: "How does the business make money?" },
        { id: "c4", question: "Why now?" },
        { id: "c5", question: "Who are the main competitors and how is this different?" },
        { id: "c6", question: "What are the milestones for the next 12 months?" },
      ],
    },
  },
  {
    id: "case-study",
    name: "Case Study",
    builtIn: true,
    bundle: {
      spec: {
        goal:
          "Tell the story of a customer's challenge, the solution applied, and the measurable results.",
        tone: "narrative, evidence-led",
        audience: "prospects, sales, marketing",
        mustInclude: ["quantified results", "direct customer quote"],
        mustAvoid: ["marketing fluff", "claims without numbers"],
      },
      outline: [
        { id: "snapshot", heading: "Customer Snapshot", description: "Industry, size, and role of the customer.", required: true },
        { id: "challenge", heading: "Challenge", description: "The specific problem the customer faced.", required: true },
        { id: "solution", heading: "Solution", description: "What was deployed and how it addressed the challenge.", required: true },
        { id: "implementation", heading: "Implementation", description: "How the rollout happened — timeline, scope, who was involved.", required: true },
        { id: "results", heading: "Results", description: "Measurable outcomes with before/after numbers.", required: true, format: "bullets" },
        { id: "quote", heading: "Customer Quote", description: "A direct quote attributed to a named customer contact.", required: true },
      ],
      checks: [
        { id: "c1", question: "Who is the customer?" },
        { id: "c2", question: "What problem were they trying to solve?" },
        { id: "c3", question: "What was the solution?" },
        { id: "c4", question: "What measurable results did they achieve?" },
        { id: "c5", question: "What did the customer say about the experience?" },
      ],
    },
  },
  {
    id: "business-idea",
    name: "Business Idea",
    builtIn: true,
    bundle: {
      spec: {
        goal:
          "Sketch a business idea clearly enough to decide whether it's worth a deeper plan.",
        tone: "exploratory, concrete",
        audience: "self, co-founders, early advisors",
        mustInclude: ["named customer", "first test or experiment"],
        mustAvoid: ["premature financials", "feature lists"],
      },
      outline: [
        { id: "pitch", heading: "One-line pitch", description: "What it is, for whom, in a single sentence.", required: true },
        { id: "customer", heading: "Customer & Problem", description: "A specific customer and the pain they feel today.", required: true },
        { id: "solution", heading: "Proposed Solution", description: "What you would build or offer, at a high level.", required: true },
        { id: "why-now", heading: "Why now", description: "What changed in the world that makes this timely.", required: true },
        { id: "risks", heading: "Risks & Unknowns", description: "Open questions that could kill the idea.", required: true, format: "bullets" },
        { id: "experiment", heading: "Smallest next experiment", description: "The cheapest thing you could do this month to learn more.", required: true },
      ],
      checks: [
        { id: "c1", question: "Who is the customer in concrete terms?" },
        { id: "c2", question: "What pain are they feeling today?" },
        { id: "c3", question: "What is the proposed solution?" },
        { id: "c4", question: "Why is this timely?" },
        { id: "c5", question: "What is the cheapest experiment that could disprove the idea?" },
      ],
    },
  },
  {
    id: "project-plan",
    name: "Project Plan",
    builtIn: true,
    bundle: {
      spec: {
        goal:
          "Define what the project will deliver, when, by whom, and what could go wrong.",
        tone: "concrete, accountable",
        audience: "project team and sponsors",
        mustInclude: ["named owner per workstream", "dated milestones"],
        mustAvoid: ["vague verbs", "milestones without dates"],
      },
      outline: [
        { id: "objective", heading: "Objective", description: "The outcome the project is committed to.", required: true },
        { id: "scope", heading: "Scope", description: "What is in scope and — explicitly — what is out.", required: true, format: "bullets" },
        { id: "workstreams", heading: "Workstreams & Owners", description: "Each major workstream with its named owner.", required: true, format: "bullets" },
        { id: "milestones", heading: "Milestones & Timeline", description: "Dated milestones from kickoff to delivery.", required: true, format: "bullets" },
        { id: "dependencies", heading: "Dependencies", description: "External teams, vendors, or decisions that could block delivery.", required: true, format: "bullets" },
        { id: "risks", heading: "Risks & Mitigations", description: "Top risks with the plan for each.", required: true, format: "bullets" },
        { id: "success", heading: "Success Criteria", description: "How everyone will agree the project succeeded.", required: true },
      ],
      checks: [
        { id: "c1", question: "What is the project's objective?" },
        { id: "c2", question: "What is explicitly out of scope?" },
        { id: "c3", question: "Who owns each workstream?" },
        { id: "c4", question: "What are the dated milestones?" },
        { id: "c5", question: "What dependencies could block delivery?" },
        { id: "c6", question: "How will success be measured?" },
      ],
    },
  },
  {
    id: "release-notes",
    name: "Release Notes",
    builtIn: true,
    bundle: {
      spec: {
        goal:
          "Tell users exactly what changed, what they need to do, and what is broken.",
        tone: "direct, user-facing",
        audience: "customers and integrators",
        mustInclude: [
          "breaking changes called out",
          "migration steps when applicable",
        ],
        mustAvoid: ["internal jargon", "marketing spin"],
      },
      outline: [
        { id: "highlights", heading: "Release Highlights", description: "The two or three things users should know about first.", required: true, format: "bullets" },
        { id: "new", heading: "New", description: "New functionality added in this release.", required: true, format: "bullets" },
        { id: "improved", heading: "Improved", description: "Existing behavior that got better.", required: true, format: "bullets" },
        { id: "fixed", heading: "Fixed", description: "Bugs resolved in this release.", required: true, format: "bullets" },
        { id: "breaking", heading: "Breaking Changes", description: "Anything that requires user action or breaks existing behavior.", required: true, format: "bullets" },
        { id: "migration", heading: "Migration Steps", description: "Step-by-step actions users must take to upgrade.", required: true, format: "bullets" },
        { id: "known", heading: "Known Issues", description: "Issues users may encounter that are not yet fixed.", required: true, format: "bullets" },
      ],
      checks: [
        { id: "c1", question: "What new functionality is in this release?" },
        { id: "c2", question: "What changed in existing behavior?" },
        { id: "c3", question: "What bugs were fixed?" },
        { id: "c4", question: "Are there any breaking changes?" },
        { id: "c5", question: "What do users need to do to upgrade?" },
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
