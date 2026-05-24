import { NextResponse } from "next/server";
import { getDefaultStore } from "@/lib/document-store";
import { generateSection, type SectionMode, type PreserveFlags } from "@/lib/generation";
import { recordVersion } from "@/lib/versions";
import { createRecordingProvider, getDefaultProvider } from "@/lib/llm";

// POST /api/generate/section
//   { documentId, outlineId, mode: "rewrite" | "expand", instruction?, preserve? }
//   → { document, outlineId, sectionText, promptLog }
//
// The engine returns prose for the target section only — by construction this
// route can never modify sibling sections (PRD §"Lock semantics are hard" /
// §"Section Rewrite Flow"). Locked sections are refused with 409 so the UI
// can surface a notice rather than silently dropping the user's intent.
export async function POST(req: Request) {
  let body: {
    documentId?: string;
    outlineId?: string;
    mode?: SectionMode;
    instruction?: string;
    preserve?: Partial<PreserveFlags>;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON: { documentId, outlineId, mode }" },
      { status: 400 }
    );
  }

  const { documentId, outlineId, mode, instruction, preserve } = body;
  if (!documentId) {
    return NextResponse.json(
      { error: "documentId is required" },
      { status: 400 }
    );
  }
  if (!outlineId) {
    return NextResponse.json(
      { error: "outlineId is required" },
      { status: 400 }
    );
  }
  if (mode !== "rewrite" && mode !== "expand") {
    return NextResponse.json(
      { error: 'mode must be "rewrite" or "expand"' },
      { status: 400 }
    );
  }

  const store = getDefaultStore();
  const doc = store.get(documentId);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!doc.outline.some((s) => s.id === outlineId)) {
    return NextResponse.json(
      { error: `outlineId ${outlineId} is not in the document outline` },
      { status: 400 }
    );
  }

  if (doc.lockedSectionIds.includes(outlineId)) {
    return NextResponse.json(
      {
        error: `Section ${outlineId} is locked. Unlock it before rewriting.`,
        outlineId,
        locked: true,
      },
      { status: 409 }
    );
  }

  const recorder = createRecordingProvider(getDefaultProvider());
  const startedAt = Date.now();
  const sectionText = await generateSection(
    doc.spec,
    doc.outline,
    doc.checks,
    outlineId,
    {
      mode,
      provider: recorder,
      instruction,
      preserve,
      existingDraft: doc.draftSections,
    }
  );
  const durationMs = Date.now() - startedAt;

  const heading =
    doc.outline.find((s) => s.id === outlineId)?.heading ?? outlineId;
  const verb = mode === "rewrite" ? "Rewrite" : "Expand";
  const updated = store.update(documentId, (existing) => {
    const next = {
      ...existing,
      draftSections: {
        ...existing.draftSections,
        [outlineId]: sectionText,
      },
    };
    return recordVersion(next, `${verb}: ${heading}`, null, {
      metrics: {
        durationMs,
        provider: recorder.kind,
        model: recorder.model,
        tokenUsage: recorder.totalUsage(),
      },
    });
  });

  return NextResponse.json({
    document: updated,
    outlineId,
    sectionText,
    promptLog: {
      kind: verb,
      timestamp: new Date().toISOString(),
      exchanges: recorder.exchanges,
    },
  });
}
