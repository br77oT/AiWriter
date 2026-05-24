import { NextResponse } from "next/server";
import { getDefaultStore } from "@/lib/document-store";
import type { Document } from "@/lib/types";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const store = getDefaultStore();
  const doc = store.get(id);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ document: doc });
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json()) as { document: Partial<Document> };
  const store = getDefaultStore();
  try {
    const doc = store.update(id, (existing) => ({
      ...existing,
      ...body.document,
    }));
    return NextResponse.json({ document: doc });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const store = getDefaultStore();
  const removed = store.delete(id);
  if (!removed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
