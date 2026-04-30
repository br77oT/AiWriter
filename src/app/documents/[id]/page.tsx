import { notFound } from "next/navigation";
import { getDefaultStore } from "@/lib/document-store";
import { Workspace } from "@/components/Workspace";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DocumentPage({ params }: PageProps) {
  const { id } = await params;
  const store = getDefaultStore();
  const doc = store.get(id);
  if (!doc) notFound();
  return <Workspace document={doc} />;
}
