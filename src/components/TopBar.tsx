"use client";

import { useState } from "react";
import { FIXTURES } from "@/lib/validation/fixtures";
import type { Template } from "@/lib/templates";

interface TopBarProps {
  documentTitle: string;
  validating: boolean;
  generating: boolean;
  canGenerate: boolean;
  templates: Template[];
  selectedTemplateId: string | null;
  canSaveAsTemplate: boolean;
  versionCount: number;
  onValidate: () => void;
  onGenerate: () => void;
  onLoadFixture: (fixtureId: string) => void;
  onSelectTemplate: (templateId: string) => void;
  onSaveAsTemplate: () => void;
  onOpenHistory: () => void;
}

// Top bar shell. Slice 009 enables the Template selector (was placeholder)
// and adds "Save as template…". Both actions delegate to Workspace, which
// owns the confirm-before-clobber + name-prompt flows.
export function TopBar({
  documentTitle,
  validating,
  generating,
  canGenerate,
  templates,
  selectedTemplateId,
  canSaveAsTemplate,
  versionCount,
  onValidate,
  onGenerate,
  onLoadFixture,
  onSelectTemplate,
  onSaveAsTemplate,
  onOpenHistory,
}: TopBarProps) {
  const [fixture, setFixture] = useState("");

  return (
    <header className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-2">
      <span className="font-semibold tracking-tight">AiWriter</span>
      <span className="text-neutral-400">·</span>
      <span className="text-sm text-neutral-700" data-testid="doc-title">
        {documentTitle}
      </span>
      <div className="ml-auto flex items-center gap-2">
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
          className="rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100"
        >
          Save
        </button>
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
        <button
          type="button"
          onClick={onValidate}
          disabled={validating}
          className="rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100 disabled:bg-neutral-100 disabled:text-neutral-400"
        >
          {validating ? "Validating…" : "Validate"}
        </button>
        <button
          type="button"
          disabled
          className="rounded border border-neutral-300 bg-neutral-100 px-3 py-1 text-sm text-neutral-400"
          title="Available in slice 012"
        >
          Export
        </button>
      </div>
    </header>
  );
}
