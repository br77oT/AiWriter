"use client";

import { useState } from "react";
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
  reviewerMode: boolean;
  onValidate: () => void;
  onGenerate: () => void;
  onLoadFixture: (fixtureId: string) => void;
  onSelectTemplate: (templateId: string) => void;
  onSaveAsTemplate: () => void;
  onOpenHistory: () => void;
  onOpenExport: () => void;
  onShareScenario: () => void;
  onToggleReviewerMode: (next: boolean) => void;
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
  reviewerMode,
  onValidate,
  onGenerate,
  onLoadFixture,
  onSelectTemplate,
  onSaveAsTemplate,
  onOpenHistory,
  onOpenExport,
  onShareScenario,
  onToggleReviewerMode,
}: TopBarProps) {
  const [fixture, setFixture] = useState("");

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-neutral-200 bg-white px-4 py-2">
      <span className="font-semibold tracking-tight">AiWriter</span>
      <span className="text-neutral-400">·</span>
      <span className="text-sm text-neutral-700" data-testid="doc-title">
        {documentTitle}
      </span>
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
