import { NextResponse } from "next/server";
import { getDefaultStore } from "@/lib/document-store";

export async function GET() {
  const store = getDefaultStore();
  return NextResponse.json({ documents: store.list() });
}

export async function POST() {
  const store = getDefaultStore();
  const doc = store.create();
  return NextResponse.json({ document: doc }, { status: 201 });
}
