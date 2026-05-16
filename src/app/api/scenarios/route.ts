import { NextResponse } from "next/server";
import { getDefaultStore } from "@/lib/document-store";
import {
  getDefaultScenarioStore,
  snapshotFromDocument,
} from "@/lib/scenario-store";

// POST /api/scenarios — freeze a document into a shareable scenario.
// Body: { documentId }. Returns { code } for a `/scenario/<code>` link.
export async function POST(request: Request): Promise<NextResponse> {
  let body: { documentId?: unknown };
  try {
    body = (await request.json()) as { documentId?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const documentId = body.documentId;
  if (typeof documentId !== "string" || documentId === "") {
    return NextResponse.json(
      { error: "documentId is required" },
      { status: 400 }
    );
  }

  const doc = getDefaultStore().get(documentId);
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const { code } = getDefaultScenarioStore().create(snapshotFromDocument(doc));
  return NextResponse.json({ code }, { status: 201 });
}
