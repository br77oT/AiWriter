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

export interface OutlineSection {
  id: string;
  heading: string;
  description: string;
  required: boolean;
  parentId?: string;
}

export interface Check {
  id: string;
  question: string;
}

export type StructuralStatus = "present" | "thin" | "missing";
export type QuestionStatus = "answered" | "partial" | "missing";

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
  draftSections: Record<string, string>;
  validationReport: ValidationReport | null;
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
