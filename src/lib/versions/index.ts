// Version history deep module — PRD §Schema "Version" + §"Document Store"
// ("CRUD for drafts and versions; supports diff between versions").
//
// A Version is an immutable snapshot of `{ draftSections, validationReport }`
// taken at a point in time, stamped with a label describing the event that
// produced it ("Generate", "Rewrite: <heading>", "Auto-fix: questions",
// "Validate", "Restore"). Versions live on the Document, so a single store
// update both records the event and persists any side-effecting state change.
//
// V1 invariant: each version snapshots the FULL draftSections + report. The
// section-keyed shape means cheap, but we don't bother with delta storage in
// V1 — revisit if size becomes a hotspot.

import type {
  Document,
  ValidationReport,
  Version,
  VersionMetrics,
} from "../types";

export interface RecordOpts {
  id?: string;
  now?: string;
  metrics?: VersionMetrics;
}

export interface SectionDiff {
  outlineId: string;
  status: "added" | "removed" | "changed" | "unchanged";
  before: string;
  after: string;
}

export function recordVersion(
  doc: Document,
  label: string,
  validationReport: ValidationReport | null,
  opts: RecordOpts = {}
): Document {
  const id = opts.id ?? globalThis.crypto.randomUUID();
  const timestamp = opts.now ?? new Date().toISOString();
  const version: Version = {
    id,
    label,
    timestamp,
    // Deep copy: snapshots must not see later mutations to the live draft.
    draftSections: { ...doc.draftSections },
    validationReport: validationReport
      ? cloneReport(validationReport)
      : null,
    ...(opts.metrics ? { metrics: opts.metrics } : {}),
  };
  return {
    ...doc,
    versions: [...doc.versions, version],
  };
}

export function listVersionsNewestFirst(versions: Version[]): Version[] {
  return [...versions].sort((a, b) =>
    a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0
  );
}

export function diffVersions(a: Version, b: Version): SectionDiff[] {
  const ids = new Set<string>([
    ...Object.keys(a.draftSections),
    ...Object.keys(b.draftSections),
  ]);
  const out: SectionDiff[] = [];
  for (const id of ids) {
    const before = a.draftSections[id];
    const after = b.draftSections[id];
    const hasBefore = before !== undefined;
    const hasAfter = after !== undefined;
    let status: SectionDiff["status"];
    if (!hasBefore && hasAfter) status = "added";
    else if (hasBefore && !hasAfter) status = "removed";
    else if (before === after) status = "unchanged";
    else status = "changed";
    out.push({
      outlineId: id,
      status,
      before: before ?? "",
      after: after ?? "",
    });
  }
  return out;
}

export function restoreVersion(
  doc: Document,
  versionId: string,
  opts: RecordOpts = {}
): Document {
  const target = doc.versions.find((v) => v.id === versionId);
  if (!target) {
    throw new Error(`Version not found: ${versionId}`);
  }
  // Replace draftSections with the snapshot, then record a new version
  // describing the restore event so the timeline shows it.
  const restored: Document = {
    ...doc,
    draftSections: { ...target.draftSections },
  };
  return recordVersion(
    restored,
    `Restore: ${target.label}`,
    target.validationReport,
    opts
  );
}

function cloneReport(report: ValidationReport): ValidationReport {
  return JSON.parse(JSON.stringify(report)) as ValidationReport;
}
