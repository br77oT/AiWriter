"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DocumentSummary } from "@/lib/types";
import type { Template } from "@/lib/templates";

interface SidebarProps {
  activeDocumentId: string;
  templates: Template[];
  onSelectTemplate: (templateId: string) => void;
}

export function Sidebar({
  activeDocumentId,
  templates,
  onSelectTemplate,
}: SidebarProps) {
  const router = useRouter();
  const [docs, setDocs] = useState<DocumentSummary[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then((data: { documents: DocumentSummary[] }) =>
        setDocs(data.documents)
      )
      .catch(() => setDocs([]));
  }, [activeDocumentId]);

  async function handleNewDocument() {
    setCreating(true);
    try {
      const res = await fetch("/api/documents", { method: "POST" });
      const { document } = (await res.json()) as {
        document: { id: string };
      };
      router.push(`/documents/${document.id}`);
    } finally {
      setCreating(false);
    }
  }

  // Show built-ins first, then user-saved (TemplateStore.list() already
  // returns them in this order).
  const userTemplates = templates.filter((t) => !t.builtIn);
  const builtInTemplates = templates.filter((t) => t.builtIn);

  return (
    <aside
      className="flex h-full w-64 shrink-0 flex-col border-r border-neutral-200 bg-white"
      aria-label="Documents and templates"
    >
      <div className="border-b border-neutral-200 p-3">
        <button
          type="button"
          onClick={handleNewDocument}
          disabled={creating}
          className="w-full rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:bg-neutral-400"
        >
          {creating ? "Creating…" : "New document"}
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        <h2 className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Recent drafts
        </h2>
        <ul className="space-y-1">
          {docs.length === 0 && (
            <li className="px-2 py-1 text-sm text-neutral-400">
              No documents yet.
            </li>
          )}
          {docs.map((doc) => (
            <li key={doc.id}>
              <Link
                href={`/documents/${doc.id}`}
                className={
                  "block truncate rounded px-2 py-1 text-sm " +
                  (doc.id === activeDocumentId
                    ? "bg-neutral-100 font-medium"
                    : "hover:bg-neutral-50")
                }
              >
                {doc.title}
              </Link>
            </li>
          ))}
        </ul>

        <h2 className="px-2 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Templates
        </h2>
        <ul className="space-y-1">
          {builtInTemplates.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onSelectTemplate(t.id)}
                aria-label={`Load template ${t.name}`}
                className="block w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-neutral-50"
              >
                {t.name}
              </button>
            </li>
          ))}
        </ul>

        {userTemplates.length > 0 && (
          <>
            <h3 className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              Saved
            </h3>
            <ul className="space-y-1">
              {userTemplates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onSelectTemplate(t.id)}
                    aria-label={`Load template ${t.name}`}
                    className="block w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-neutral-50"
                  >
                    {t.name}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </nav>
    </aside>
  );
}
