"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DocumentSummary } from "@/lib/types";
import type { Template } from "@/lib/templates";
import { formatRelativeTime } from "@/lib/relative-time";
import { CollapsedStrip, CollapseButton } from "./panes/CollapsiblePane";

interface SidebarProps {
  activeDocumentId: string;
  // Kept for compatibility with the existing call site; templates are no
  // longer surfaced in the sidebar (they live in the onboarding wizard and
  // the AppMenu picker). Unused here.
  templates?: Template[];
  onSelectTemplate?: (templateId: string) => void;
  // When true, the sidebar fills its parent rather than imposing a fixed
  // width. Used by the mobile layout where the drawer owns the width.
  compact?: boolean;
  // Reviewer mode (slice 014): kept for compatibility but no longer changes
  // any visible affordance — there is no template list to hide.
  readOnly?: boolean;
  // Collapse seam — same pattern as the other panes. When collapsed, the
  // sidebar renders as a thin vertical strip with an Expand button. Only
  // wired up on desktop (mobile already has its own drawer pattern).
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({
  activeDocumentId,
  compact = false,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const router = useRouter();
  const [docs, setDocs] = useState<DocumentSummary[]>([]);
  // Live filter on the Recent drafts list. Per-session only (intentional —
  // it's a quick "find this draft" affordance, not a stored preference).
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then((data: { documents: DocumentSummary[] }) =>
        setDocs(data.documents)
      )
      .catch(() => setDocs([]));
  }, [activeDocumentId]);

  const trimmedFilter = filter.trim().toLowerCase();
  const visibleDocs =
    trimmedFilter === ""
      ? docs
      : docs.filter((d) => d.title.toLowerCase().includes(trimmedFilter));

  // "New document" routes through the onboarding wizard rather than POSTing
  // /api/documents directly. Per PRD user story 37 / issue 010 AC:
  // "'New document' action goes through the wizard, not directly to a blank
  // workspace." The wizard is responsible for creating + applying a template.
  function handleNewDocument() {
    router.push("/onboarding");
  }

  if (collapsed && onToggleCollapse) {
    return (
      <div className="w-10 shrink-0">
        <CollapsedStrip label="Documents" onExpand={onToggleCollapse} />
      </div>
    );
  }
  return (
    <aside
      className={
        "flex h-full flex-col border-r border-neutral-200 bg-white " +
        (compact ? "w-full" : "w-64 shrink-0")
      }
      aria-label="Documents"
    >
      <div className="flex items-center gap-2 border-b border-neutral-200 p-3">
        <button
          type="button"
          onClick={handleNewDocument}
          className="flex-1 rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          New document
        </button>
        {onToggleCollapse && (
          <CollapseButton label="Documents" onCollapse={onToggleCollapse} />
        )}
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        <h2 className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Recent drafts
        </h2>
        {docs.length > 0 && (
          <div className="relative px-2 pb-2">
            <input
              type="text"
              aria-label="Filter drafts by title"
              placeholder="Filter…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="ds-input ds-input--sm w-full pr-7"
            />
            {filter !== "" && (
              <button
                type="button"
                aria-label="Clear filter"
                onClick={() => setFilter("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs leading-none text-neutral-400 hover:text-neutral-700"
              >
                ×
              </button>
            )}
          </div>
        )}
        <ul className="space-y-1">
          {docs.length === 0 && (
            <li className="px-2 py-1 text-sm text-neutral-400">
              No documents yet.
            </li>
          )}
          {docs.length > 0 && visibleDocs.length === 0 && (
            <li
              className="px-2 py-1 text-sm text-neutral-400"
              data-testid="sidebar-no-filter-matches"
            >
              No drafts match &ldquo;{filter}&rdquo;.
            </li>
          )}
          {visibleDocs.map((doc) => (
            <li key={doc.id}>
              <Link
                href={`/documents/${doc.id}`}
                className={
                  "block rounded px-2 py-1 text-sm " +
                  (doc.id === activeDocumentId
                    ? "bg-neutral-100 font-medium"
                    : "hover:bg-neutral-50")
                }
              >
                <div className="truncate">{doc.title}</div>
                <div
                  data-testid={`doc-row-time-${doc.id}`}
                  className="truncate text-xs font-normal text-neutral-400"
                  title={new Date(doc.updatedAt).toLocaleString()}
                >
                  {formatRelativeTime(doc.updatedAt)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
