import { NextResponse } from "next/server";
import { getDefaultStore } from "@/lib/document-store";
import { validate } from "@/lib/validation";
import { recordVersion } from "@/lib/versions";

// POST /api/validate { documentId } → { report, document }
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
  const report = await validate(doc.draftSections, doc.outline, doc.checks);
  const updated = store.update(documentId, (existing) =>
    recordVersion(existing, "Validate", report)
  );
  return NextResponse.json({ report, document: updated });
}
