// Document schema — the spine of the product.
// Mirrors PRD §Schema. Keep this file the single source of truth for shapes;
// the SQLite store, API routes, and UI all import from here.

export interface Spec {
  goal: string;
  tone: string;
  audience: string;
  mustInclude: string[];
  mustAvoid: string[];
}

// How the model should format the section's prose. Sections without a
// `format` (or with `"prose"`) get the default freeform paragraph treatment;
// `"bullets"` asks for `- item` rows and `"numbered"` asks for `1.`/`2.`/…
// rows. The Generation engine appends an explicit instruction to its prompt
// when this is set, so the model doesn't have to infer from the heading.
export type SectionFormat = "prose" | "bullets" | "numbered";

export interface OutlineSection {
  id: string;
  heading: string;
  description: string;
  required: boolean;
  parentId?: string;
  format?: SectionFormat;
}

export interface Check {
  id: string;
  question: string;
}

export type StructuralStatus = "present" | "thin" | "missing";
// "error" — the check could not be evaluated at all (the LLM evaluator threw
// or returned an unusable response). Distinct from "missing", which is a real
// content gap. Keeps an infrastructure failure from masquerading as a draft
// problem.
export type QuestionStatus = "answered" | "partial" | "missing" | "error";

export interface ValidationReport {
  structure: Array<{
    outlineId: string;
    status: StructuralStatus;
    note?: string;
  }>;
  questions: Array<{
    checkId: string;
    status: QuestionStatus;
    evidence?: string;
    suggestion?: string;
  }>;
  coverageScore: {
    checksAnswered: number;
    checksTotal: number;
    sectionsPresent: number;
    sectionsTotal: number;
  };
}

export interface Version {
  id: string;
  timestamp: string;
  // Short human-readable event tag — e.g. "Generate", "Rewrite: Impact",
  // "Auto-fix: questions", "Validate", "Restore". Rendered in the version
  // history sidebar; not load-bearing for diffing or restore.
  label: string;
  draftSections: Record<string, string>;
  validationReport: ValidationReport | null;
  // Optional per-event telemetry the Statistics pane consumes. Older
  // versions (pre-instrumentation) and "Restore" events leave it undefined.
  metrics?: VersionMetrics;
}

export interface VersionMetrics {
  // Wall-clock duration of the LLM-touching server-side work, in ms.
  durationMs?: number;
  // Which provider produced this version. Influences cost interpretation:
  // "anthropic" charges the API price, "local" is free but we still surface
  // a would-be-cost estimate against the default Anthropic model.
  provider?: "anthropic" | "local" | "stub";
  // Concrete model name when known (e.g. "claude-sonnet-4-5"). Used by the
  // pricing helper to look up rates.
  model?: string;
  // Sum of token usage across every LLM exchange in this event. Local-mode
  // runs typically omit this (the WS server doesn't surface counts).
  tokenUsage?: { inputTokens: number; outputTokens: number };
}

export interface ChecksConfig {
  evaluateAfterEveryGeneration: boolean;
  blockExportIfMissing: boolean;
}

export interface Document {
  id: string;
  title: string;
  templateId: string | null;
  spec: Spec;
  outline: OutlineSection[];
  checks: Check[];
  checksConfig: ChecksConfig;
  draftSections: Record<string, string>;
  lockedSectionIds: string[];
  outlineFrozen: boolean;
  versions: Version[];
  createdAt: string;
  updatedAt: string;
}

export interface DocumentSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export function emptySpec(): Spec {
  return {
    goal: "",
    tone: "",
    audience: "",
    mustInclude: [],
    mustAvoid: [],
  };
}

export function emptyChecksConfig(): ChecksConfig {
  return {
    evaluateAfterEveryGeneration: true,
    blockExportIfMissing: false,
  };
}

export function newDocument(id: string, now: string): Document {
  return {
    id,
    title: "Untitled document",
    templateId: null,
    spec: emptySpec(),
    outline: [],
    checks: [],
    checksConfig: emptyChecksConfig(),
    draftSections: {},
    lockedSectionIds: [],
    outlineFrozen: false,
    versions: [],
    createdAt: now,
    updatedAt: now,
  };
}
