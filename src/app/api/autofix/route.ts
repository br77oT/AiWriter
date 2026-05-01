import { NextResponse } from "next/server";
import { getDefaultStore } from "@/lib/document-store";
import { generateSection } from "@/lib/generation";
import { validate } from "@/lib/validation";
import type { Document, ValidationReport } from "@/lib/types";

// POST /api/autofix
//   { documentId, mode: "questions" | "structure" }
//   → { document, draftSections, regeneratedSectionIds, lockedSkipped }
//
// Two entry points share the same plumbing:
//
// - "questions" (Auto-fix missing items, PRD user story 24): regenerates
//   sections that "contain" a failing check. Mapping is evidence-based — a
//   section "contains" a partial check if its draft text contains the check's
//   evidence quote. For `missing` checks (no evidence available), we fall
//   back to sections flagged structurally weak (missing/thin) since those are
//   the most likely homes for the absent answer.
//
// - "structure" (Regenerate failed sections, PRD user story 25): regenerates
//   sections marked `missing` or `thin` by the Structural Evaluator.
//
// Both flows skip locked sections (PRD §"Lock semantics are hard"). Locked
// failing sections are returned in `lockedSkipped` so the UI can surface a
// notice rather than silently dropping them.
type AutofixMode = "questions" | "structure";

interface SectionPlan {
  outlineId: string;
  instruction: string;
}

export async function POST(req: Request) {
  let body: { documentId?: string; mode?: AutofixMode } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON: { documentId, mode }" },
      { status: 400 }
    );
  }

  const { documentId, mode } = body;
  if (!documentId) {
    return NextResponse.json(
      { error: "documentId is required" },
      { status: 400 }
    );
  }
  if (mode !== "questions" && mode !== "structure") {
    return NextResponse.json(
      { error: 'mode must be "questions" or "structure"' },
      { status: 400 }
    );
  }

  const store = getDefaultStore();
  const doc = store.get(documentId);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Compute a fresh report so target selection reflects the current document
  // state — the UI may hold a stale report if the user typed since.
  const report = await validate(doc.draftSections, doc.outline, doc.checks);

  const { plan, lockedSkipped } =
    mode === "questions"
      ? planQuestionsMode(doc, report)
      : planStructureMode(doc, report);

  // Sequential — same shape as the full-draft engine. Cost is dominated by
  // per-section depth; sequential keeps token budgets predictable.
  const regenerated: Record<string, string> = {};
  for (const item of plan) {
    const sectionText = await generateSection(
      doc.spec,
      doc.outline,
      doc.checks,
      item.outlineId,
      {
        mode: "rewrite",
        instruction: item.instruction,
        existingDraft: doc.draftSections,
      }
    );
    regenerated[item.outlineId] = sectionText;
  }

  let updated = doc;
  if (Object.keys(regenerated).length > 0) {
    updated = store.update(documentId, (existing) => ({
      ...existing,
      draftSections: { ...existing.draftSections, ...regenerated },
    }));
  }

  return NextResponse.json({
    document: updated,
    draftSections: updated.draftSections,
    regeneratedSectionIds: plan.map((p) => p.outlineId),
    lockedSkipped,
  });
}

function planQuestionsMode(
  doc: Document,
  report: ValidationReport
): { plan: SectionPlan[]; lockedSkipped: string[] } {
  const failing = report.questions.filter(
    (q) => q.status === "missing" || q.status === "partial"
  );
  if (failing.length === 0) {
    return { plan: [], lockedSkipped: [] };
  }

  // Map each failing check to one or more candidate sections.
  const checksBySection = new Map<string, ValidationReport["questions"]>();
  const structuralFailingIds = report.structure
    .filter((s) => s.status === "missing" || s.status === "thin")
    .map((s) => s.outlineId);

  for (const check of failing) {
    const owners: string[] = [];
    if (check.evidence) {
      // Find sections whose current draft text contains the evidence span.
      for (const section of doc.outline) {
        const text = doc.draftSections[section.id] ?? "";
        if (text.includes(check.evidence)) owners.push(section.id);
      }
    }
    // Missing-status checks (no evidence) and partial-status checks whose
    // evidence we couldn't locate fall back to structurally weak sections —
    // those are the most plausible homes for the absent answer.
    if (owners.length === 0) {
      owners.push(...structuralFailingIds);
    }
    for (const id of owners) {
      const list = checksBySection.get(id) ?? [];
      list.push(check);
      checksBySection.set(id, list);
    }
  }

  const lockedSet = new Set(doc.lockedSectionIds);
  const plan: SectionPlan[] = [];
  const lockedSkipped: string[] = [];

  for (const section of doc.outline) {
    const checksForSection = checksBySection.get(section.id);
    if (!checksForSection || checksForSection.length === 0) continue;
    if (lockedSet.has(section.id)) {
      lockedSkipped.push(section.id);
      continue;
    }
    plan.push({
      outlineId: section.id,
      instruction: renderQuestionsInstruction(checksForSection, doc),
    });
  }
  return { plan, lockedSkipped };
}

function planStructureMode(
  doc: Document,
  report: ValidationReport
): { plan: SectionPlan[]; lockedSkipped: string[] } {
  const lockedSet = new Set(doc.lockedSectionIds);
  const plan: SectionPlan[] = [];
  const lockedSkipped: string[] = [];

  for (const struct of report.structure) {
    if (struct.status !== "missing" && struct.status !== "thin") continue;
    if (lockedSet.has(struct.outlineId)) {
      lockedSkipped.push(struct.outlineId);
      continue;
    }
    plan.push({
      outlineId: struct.outlineId,
      instruction: renderStructureInstruction(struct.status, struct.note),
    });
  }
  return { plan, lockedSkipped };
}

function renderQuestionsInstruction(
  failingChecks: ValidationReport["questions"],
  doc: Document
): string {
  const lines: string[] = [
    "Address the following unanswered or partially-answered checks for this document. Make sure the rewritten section directly answers the question(s) below. Cite concrete details where appropriate.",
    "",
  ];
  for (const check of failingChecks) {
    const question =
      doc.checks.find((c) => c.id === check.checkId)?.question ??
      "(unknown question)";
    lines.push(`- Question: ${question}`);
    lines.push(`  Status: ${check.status}`);
    if (check.suggestion) lines.push(`  Suggestion: ${check.suggestion}`);
  }
  return lines.join("\n");
}

function renderStructureInstruction(
  status: "missing" | "thin",
  note: string | undefined
): string {
  const verb = status === "missing" ? "missing" : "structurally thin";
  const noteLine = note ? ` Validator note: ${note}` : "";
  return `This section was flagged as ${verb} by the structural evaluator.${noteLine} Produce a substantive section that fully covers the heading.`;
}
