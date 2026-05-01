import { NextResponse } from "next/server";
import { getDefaultStore } from "@/lib/document-store";
import { generate } from "@/lib/generation";

// POST /api/generate { documentId } → { document, draftSections }
//
// Full-draft mode: regenerates every unlocked section. Locked sections stay
// bit-identical (slice 007 introduces the lock UI; the route already honors
// it so the contract is stable).
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

  const generated = await generate(doc.spec, doc.outline, doc.checks, {
    lockedSectionIds: doc.lockedSectionIds,
    outlineFrozen: doc.outlineFrozen,
    existingDraft: doc.draftSections,
  });

  // Merge: locked sections retain their existing prose; only unlocked IDs
  // get overwritten. Sections whose outline ID was removed since the last
  // generation are pruned implicitly because we only carry forward locked
  // ones.
  const lockedIds = new Set(doc.lockedSectionIds);
  const merged: Record<string, string> = {};
  for (const section of doc.outline) {
    if (lockedIds.has(section.id) && doc.draftSections[section.id]) {
      merged[section.id] = doc.draftSections[section.id];
    } else if (generated[section.id] !== undefined) {
      merged[section.id] = generated[section.id];
    }
  }

  const updated = store.update(documentId, (existing) => ({
    ...existing,
    draftSections: merged,
  }));

  return NextResponse.json({
    document: updated,
    draftSections: merged,
  });
}
