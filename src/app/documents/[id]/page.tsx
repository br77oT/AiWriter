import { notFound } from "next/navigation";
import { getDefaultStore } from "@/lib/document-store";
import { getLlmKeyStatus } from "@/lib/llm";
import { Workspace } from "@/components/Workspace";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DocumentPage({ params }: PageProps) {
  const { id } = await params;
  const store = getDefaultStore();
  const doc = store.get(id);
  if (!doc) notFound();
  // Server-side check — passed down so the workspace can warn when the LLM
  // key is missing or unusable.
  return <Workspace document={doc} llmKeyStatus={getLlmKeyStatus()} />;
}
