"use client";

import { useState } from "react";
import type { ScenarioSummary } from "@/lib/scenario-store";

// Client list for the scenarios gallery. The page resolves the data
// server-side; this component only adds the copy-to-clipboard interaction.
export function ScenariosList({ scenarios }: { scenarios: ScenarioSummary[] }) {
  if (scenarios.length === 0) {
    return (
      <p className="text-sm text-neutral-500" data-testid="scenarios-empty">
        No scenario links yet. Open a document and use{" "}
        <span className="font-medium">Share link</span> to create one.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {scenarios.map((scenario) => (
        <ScenarioRow key={scenario.code} scenario={scenario} />
      ))}
    </ul>
  );
}

function ScenarioRow({ scenario }: { scenario: ScenarioSummary }) {
  const [copied, setCopied] = useState(false);
  const path = `/scenario/${scenario.code}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
    } catch {
      // Clipboard unavailable (insecure context / permissions) — no-op.
    }
  }

  return (
    <li className="flex items-center gap-3 rounded border border-neutral-200 bg-white p-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-neutral-800">
          {scenario.title}
        </div>
        <div className="text-xs text-neutral-500">
          {scenario.sectionCount} section
          {scenario.sectionCount === 1 ? "" : "s"} · {scenario.checkCount} check
          {scenario.checkCount === 1 ? "" : "s"} ·{" "}
          <span className="font-mono">{scenario.code}</span> ·{" "}
          {formatDate(scenario.createdAt)}
        </div>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy link for ${scenario.title}`}
        className="shrink-0 rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100"
      >
        {copied ? "Copied" : "Copy link"}
      </button>
      <a
        href={path}
        aria-label={`Open ${scenario.title}`}
        className="shrink-0 rounded border border-neutral-900 bg-neutral-900 px-3 py-1 text-sm text-white hover:bg-neutral-800"
      >
        Open →
      </a>
    </li>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
