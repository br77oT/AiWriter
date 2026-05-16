import { notFound, redirect } from "next/navigation";
import { getDefaultStore } from "@/lib/document-store";
import {
  applySnapshotToDocument,
  getDefaultScenarioStore,
} from "@/lib/scenario-store";

interface PageProps {
  params: Promise<{ code: string }>;
}

// `/scenario/<code>` — the shareable entry point. Each visit mints a *fresh*
// document from the frozen snapshot (so the link is reusable and viewers never
// edit the original), then redirects into the workspace with `?autorun` set so
// the draft is generated and validated automatically.
export default async function ScenarioPage({ params }: PageProps) {
  const { code } = await params;
  const snapshot = getDefaultScenarioStore().get(code);
  if (!snapshot) notFound();

  const docStore = getDefaultStore();
  const created = docStore.create();
  docStore.update(created.id, (doc) => applySnapshotToDocument(doc, snapshot));

  // redirect() throws internally — must stay outside any try/catch.
  redirect(`/documents/${created.id}?autorun=generate,validate`);
}
