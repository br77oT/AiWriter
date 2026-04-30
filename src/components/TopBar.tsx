"use client";

import { useState } from "react";
import { FIXTURES } from "@/lib/validation/fixtures";

interface TopBarProps {
  documentTitle: string;
  validating: boolean;
  onValidate: () => void;
  onLoadFixture: (fixtureId: string) => void;
}

// Top bar shell — slice 002 enables the Validate button and adds a dev-only
// "Load fixture" select so the right rail can be exercised before the
// Spec/Outline/Checks editor panels exist (slices 003–005).
export function TopBar({
  documentTitle,
  validating,
  onValidate,
  onLoadFixture,
}: TopBarProps) {
  const [template, setTemplate] = useState("");
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
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
        >
          <option value="">Template…</option>
          <option value="incident-report">Incident Report</option>
          <option value="postmortem">Postmortem</option>
          <option value="status-report">Status Report</option>
          <option value="custom">Custom</option>
        </select>
        <button
          type="button"
          className="rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100"
        >
          Save
        </button>
        <button
          type="button"
          disabled
          className="rounded border border-neutral-300 bg-neutral-100 px-3 py-1 text-sm text-neutral-400"
          title="Available in slice 006"
        >
          Generate Draft
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
