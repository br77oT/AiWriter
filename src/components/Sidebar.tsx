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
  // When true, the sidebar fills its parent rather than imposing a fixed
  // width. Used by the mobile layout where the drawer owns the width.
  compact?: boolean;
  // Reviewer mode (slice 014): hides the Templates list (selecting one
  // mutates the doc) but keeps Recent drafts navigation + New document
  // (which routes to /onboarding without touching the current doc).
  readOnly?: boolean;
}

export function Sidebar({
  activeDocumentId,
  templates,
  onSelectTemplate,
  compact = false,
  readOnly = false,
}: SidebarProps) {
  const router = useRouter();
  const [docs, setDocs] = useState<DocumentSummary[]>([]);

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then((data: { documents: DocumentSummary[] }) =>
        setDocs(data.documents)
      )
      .catch(() => setDocs([]));
  }, [activeDocumentId]);

  // "New document" routes through the onboarding wizard rather than POSTing
  // /api/documents directly. Per PRD user story 37 / issue 010 AC:
  // "'New document' action goes through the wizard, not directly to a blank
  // workspace." The wizard is responsible for creating + applying a template.
  function handleNewDocument() {
    router.push("/onboarding");
  }

  // Show built-ins first, then user-saved (TemplateStore.list() already
  // returns them in this order).
  const userTemplates = templates.filter((t) => !t.builtIn);
  const builtInTemplates = templates.filter((t) => t.builtIn);

  return (
    <aside
      className={
        "flex h-full flex-col border-r border-neutral-200 bg-white " +
        (compact ? "w-full" : "w-64 shrink-0")
      }
      aria-label="Documents and templates"
    >
      <div className="border-b border-neutral-200 p-3">
        <button
          type="button"
          onClick={handleNewDocument}
          className="w-full rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          New document
        </button>
        <Link
          href="/scenarios"
          className="mt-2 block text-center text-xs text-neutral-500 hover:text-neutral-800 hover:underline"
        >
          Scenario links
        </Link>
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

        {!readOnly && (
          <>
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
          </>
        )}
      </nav>
    </aside>
  );
}
