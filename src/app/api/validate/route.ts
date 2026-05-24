import { NextResponse } from "next/server";
import { getDefaultStore } from "@/lib/document-store";
import { validate } from "@/lib/validation";
import { recordVersion } from "@/lib/versions";
import { createRecordingProvider, getDefaultProvider } from "@/lib/llm";

// POST /api/validate { documentId } → { report, document, promptLog }
//
// Slice 011 wires this route into version history: every on-demand validate
// snapshots the (unchanged) draft + the fresh report, so users can see how
// validation status moved over time without having to also regenerate.
export async function POST(req: Request) {
  let body: { documentId?: string } = {};
  try {
    body = (await req.json()) as { documentId?: string };
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON: { documentId }" },
      { status: 400 }
    );
  }
  const documentId = body.documentId;
  if (!documentId) {
    return NextResponse.json(
      { error: "documentId is required" },
      { status: 400 }
    );
  }
  const store = getDefaultStore();
  const doc = store.get(documentId);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Wrap the provider so the Prompt Inspector can show the per-check
  // evaluator prompts this route sent.
  const recorder = createRecordingProvider(getDefaultProvider());
  const startedAt = Date.now();
  const report = await validate(doc.draftSections, doc.outline, doc.checks, {
    provider: recorder,
  });
  const durationMs = Date.now() - startedAt;
  const updated = store.update(documentId, (existing) =>
    recordVersion(existing, "Validate", report, {
      metrics: {
        durationMs,
        provider: recorder.kind,
        model: recorder.model,
        tokenUsage: recorder.totalUsage(),
      },
    })
  );
  return NextResponse.json({
    report,
    document: updated,
    promptLog: {
      kind: "Validate",
      timestamp: new Date().toISOString(),
      exchanges: recorder.exchanges,
    },
  });
}
