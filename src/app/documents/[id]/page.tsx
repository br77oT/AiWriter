import { notFound } from "next/navigation";
import { getDefaultStore } from "@/lib/document-store";
import { isLlmConfigured } from "@/lib/llm";
import { Workspace } from "@/components/Workspace";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DocumentPage({ params }: PageProps) {
  const { id } = await params;
  const store = getDefaultStore();
  const doc = store.get(id);
  if (!doc) notFound();
  // Server-side check — passed down so the workspace can warn when generation
  // and validation are running against the stub provider.
  return <Workspace document={doc} llmConfigured={isLlmConfigured()} />;
}
