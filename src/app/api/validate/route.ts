import { NextResponse } from "next/server";
import { getDefaultStore } from "@/lib/document-store";
import { validate } from "@/lib/validation";

// POST /api/validate { documentId } → ValidationReport
// Persists nothing on its own — slice 011 adds versioning later.
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
  return NextResponse.json({ report });
}
