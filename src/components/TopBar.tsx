"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FIXTURES } from "@/lib/validation/fixtures";
import type { Template } from "@/lib/templates";

interface TopBarProps {
  documentTitle: string;
  validating: boolean;
  generating: boolean;
  canGenerate: boolean;
  canExport: boolean;
  templates: Template[];
  selectedTemplateId: string | null;
  canSaveAsTemplate: boolean;
  versionCount: number;
  // Whether an LLM action has run this session, so the Prompts button has a
  // transcript to show.
  hasPromptLog: boolean;
  reviewerMode: boolean;
  onValidate: () => void;
  onGenerate: () => void;
  onLoadFixture: (fixtureId: string) => void;
  onSelectTemplate: (templateId: string) => void;
  onSaveAsTemplate: () => void;
  onOpenHistory: () => void;
  onOpenPrompts: () => void;
  onOpenExport: () => void;
  onShareScenario: () => void;
  onToggleReviewerMode: (next: boolean) => void;
  // Document-level actions. Omitted in reviewer mode (the buttons hide).
  onRenameDocument?: (nextTitle: string) => void;
  onDeleteDocument?: () => void;
}

// Top bar shell. In reviewer mode (slice 014), mutating actions are hidden:
// Generate / Validate / Export / Save / Save-as-template / Template selector /
// Load fixture. The History button stays visible (reviewers can browse) and
// the Reviewer-mode toggle stays visible so an author can flip back. Per
// PRD user story 39 + issue 014.
export function TopBar({
  documentTitle,
  validating,
  generating,
  canGenerate,
  canExport,
  templates,
  selectedTemplateId,
  canSaveAsTemplate,
  versionCount,
  hasPromptLog,
  reviewerMode,
  onValidate,
  onGenerate,
  onLoadFixture,
  onSelectTemplate,
  onSaveAsTemplate,
  onOpenHistory,
  onOpenPrompts,
  onOpenExport,
  onShareScenario,
  onToggleReviewerMode,
  onRenameDocument,
  onDeleteDocument,
}: TopBarProps) {
  const [fixture, setFixture] = useState("");

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-neutral-200 bg-white px-4 py-2">
      <span className="font-semibold tracking-tight">AiWriter</span>
      <span className="text-neutral-400">·</span>
      <DocumentTitle
        title={documentTitle}
        editable={!reviewerMode && Boolean(onRenameDocument)}
        onRename={onRenameDocument}
      />
      {!reviewerMode && onDeleteDocument && (
        <button
          type="button"
          aria-label="Delete document"
          title="Delete this document. This cannot be undone."
          onClick={() => {
            const ok = window.confirm(
              `Delete "${documentTitle}"? This cannot be undone.`
            );
            if (ok) onDeleteDocument();
          }}
          className="rounded border border-red-300 bg-white px-2 py-0.5 text-xs text-red-700 hover:bg-red-50"
        >
          Delete
        </button>
      )}
      {reviewerMode && (
        <span
          data-testid="reviewer-mode-badge"
          className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800"
        >
          Reviewer mode
        </span>
      )}
      <Link
        href="/scenarios"
        className="text-sm font-medium text-blue-600 underline hover:text-blue-800"
      >
        Examples
      </Link>
      <div className="ml-auto flex items-center gap-2">
        <label className="flex items-center gap-1 text-sm text-neutral-700">
          <input
            type="checkbox"
            aria-label="Reviewer mode"
            checked={reviewerMode}
            onChange={(e) => onToggleReviewerMode(e.target.checked)}
          />
          Reviewer mode
        </label>
        {!reviewerMode && (
          <select
            aria-label="Load fixture"
            className="rounded border border-dashed border-neutral-300 px-2 py-1 text-sm text-neutral-600"
            value={fixture}
            onChange={(e) => {
              const id = e.target.value;
              setFixture(id);
              if (id) onLoadFixture(id);
            }}
          >
            <option value="">Load fixture (dev)…</option>
            {FIXTURES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        )}
        {!reviewerMode && (
          <select
            aria-label="Template"
            className="rounded border border-neutral-300 px-2 py-1 text-sm"
            value={selectedTemplateId ?? ""}
            onChange={(e) => {
              const id = e.target.value;
              if (id) onSelectTemplate(id);
            }}
          >
            <option value="">Template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        {!reviewerMode && (
          <button
            type="button"
            onClick={onSaveAsTemplate}
            disabled={!canSaveAsTemplate}
            title={
              canSaveAsTemplate
                ? undefined
                : "Add at least one outline section, check, or spec field to save as template."
            }
            className="rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100 disabled:bg-neutral-100 disabled:text-neutral-400"
          >
            Save as template…
          </button>
        )}
        <button
          type="button"
          onClick={onOpenHistory}
          disabled={versionCount === 0}
          title={
            versionCount === 0
              ? "Run Generate, Validate, Rewrite, or Auto-fix to record a version."
              : undefined
          }
          className="rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100 disabled:bg-neutral-100 disabled:text-neutral-400"
        >
          History{versionCount > 0 ? ` (${versionCount})` : ""}
        </button>
        <button
          type="button"
          onClick={onOpenPrompts}
          disabled={!hasPromptLog}
          title={
            hasPromptLog
              ? "Show the exact prompt sent to the LLM by the last action."
              : "Run Generate, Validate, Rewrite, or Auto-fix to capture a prompt."
          }
          className="rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100 disabled:bg-neutral-100 disabled:text-neutral-400"
        >
          Prompts
        </button>
        {!reviewerMode && (
          <button
            type="button"
            className="rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100"
          >
            Save
          </button>
        )}
        {!reviewerMode && (
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating || !canGenerate}
            title={
              canGenerate
                ? undefined
                : "Add at least one outline section to generate."
            }
            className="rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100 disabled:bg-neutral-100 disabled:text-neutral-400"
          >
            {generating ? "Generating…" : "Generate Draft"}
          </button>
        )}
        {!reviewerMode && (
          <button
            type="button"
            onClick={onValidate}
            disabled={validating}
            className="rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100 disabled:bg-neutral-100 disabled:text-neutral-400"
          >
            {validating ? "Validating…" : "Validate"}
          </button>
        )}
        {!reviewerMode && (
          <button
            type="button"
            onClick={onShareScenario}
            title="Create a link that recreates this document and auto-runs Generate + Validate."
            className="rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100"
          >
            Share link
          </button>
        )}
        {!reviewerMode && (
          <button
            type="button"
            onClick={onOpenExport}
            disabled={!canExport}
            title={
              canExport
                ? undefined
                : "Add at least one section of draft text before exporting."
            }
            className="rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100 disabled:bg-neutral-100 disabled:text-neutral-400"
          >
            Export
          </button>
        )}
      </div>
    </header>
  );
}

// Inline-editable title. Clicking the title (when editable) flips it into a
// text input. Enter or blur commits; Escape cancels. Blank titles fall back
// to "Untitled document" so the sidebar always has something to render.
function DocumentTitle({
  title,
  editable,
  onRename,
}: {
  title: string;
  editable: boolean;
  onRename?: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Stay in sync if the doc gets renamed elsewhere while we're not editing.
  useEffect(() => {
    if (!editing) setDraft(title);
  }, [title, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const next = draft.trim() || "Untitled document";
    setEditing(false);
    setDraft(next);
    if (next !== title) onRename?.(next);
  };
  const cancel = () => {
    setDraft(title);
    setEditing(false);
  };

  if (!editable) {
    return (
      <span className="text-sm text-neutral-700" data-testid="doc-title">
        {title}
      </span>
    );
  }
  if (!editing) {
    return (
      <button
        type="button"
        data-testid="doc-title"
        title="Click to rename"
        onClick={() => setEditing(true)}
        className="rounded text-sm text-neutral-700 hover:bg-neutral-100 px-1 -mx-1"
      >
        {title}
      </button>
    );
  }
  return (
    <input
      ref={inputRef}
      data-testid="doc-title-input"
      aria-label="Rename document"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancel();
        }
      }}
      className="rounded border border-neutral-300 bg-white px-1 py-0.5 text-sm text-neutral-800"
    />
  );
}
