import { NextResponse } from "next/server";
import { getDefaultStore } from "@/lib/document-store";
import { restoreVersion } from "@/lib/versions";

// POST /api/documents/:id/versions/:versionId/restore → { document }
//
// Replaces the live draftSections with the chosen version's snapshot AND
// records a new "Restore: <previous label>" version so the timeline shows
// the restore event itself. Spec / outline / checks / locks are NOT touched.
interface Ctx {
  params: Promise<{ id: string; versionId: string }>;
}

export async function POST(_req: Request, { params }: Ctx) {
  const { id, versionId } = await params;
  const store = getDefaultStore();
  const doc = store.get(id);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!doc.versions.some((v) => v.id === versionId)) {
    return NextResponse.json(
      { error: `Version ${versionId} not found on document ${id}` },
      { status: 404 }
    );
  }
  const updated = store.update(id, (existing) =>
    restoreVersion(existing, versionId)
  );
  return NextResponse.json({ document: updated });
}
