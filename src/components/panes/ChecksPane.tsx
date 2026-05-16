"use client";

import type { Check, ChecksConfig } from "@/lib/types";
import { CollapseButton, CollapsedStrip } from "./CollapsiblePane";

interface ChecksPaneProps {
  checks: Check[];
  checksConfig: ChecksConfig;
  onChecksChange: (next: Check[]) => void;
  onChecksConfigChange: (next: ChecksConfig) => void;
  onLoadTemplate: () => void;
  readOnly?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

// Controlled component: never owns checks/config state. Workspace holds the
// document and persists. Each row carries its own stable id (per
// `Document.checks`), so editing one row's question text never re-keys
// siblings — the ValidationReport.questions[].checkId references stay valid.
export function ChecksPane({
  checks,
  checksConfig,
  onChecksChange,
  onChecksConfigChange,
  onLoadTemplate,
  readOnly = false,
  collapsed = false,
  onToggleCollapse,
}: ChecksPaneProps) {
  function handleAdd() {
    onChecksChange([...checks, { id: makeId(), question: "" }]);
  }

  function handleRemove(id: string) {
    onChecksChange(checks.filter((c) => c.id !== id));
  }

  function handleEdit(id: string, question: string) {
    onChecksChange(
      checks.map((c) => (c.id === id ? { ...c, question } : c))
    );
  }

  if (collapsed && onToggleCollapse) {
    return <CollapsedStrip label="Checks" onExpand={onToggleCollapse} />;
  }

  return (
    <section
      className="flex h-full flex-col gap-3 overflow-y-auto border-r border-neutral-200 bg-white p-3"
      aria-labelledby="checks-pane-heading"
    >
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <h2
            id="checks-pane-heading"
            className="text-sm font-semibold uppercase tracking-wide text-neutral-600"
          >
            Checks
          </h2>
          {onToggleCollapse && (
            <CollapseButton label="Checks" onCollapse={onToggleCollapse} />
          )}
        </div>
        <button
          type="button"
          onClick={onLoadTemplate}
          disabled={readOnly}
          className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
        >
          Load template
        </button>
      </div>

      {checks.length === 0 ? (
        <p className="text-sm text-neutral-400">
          No checks yet. Click <span className="font-medium">Add check</span> to
          add a question the draft must answer.
        </p>
      ) : (
        <ol className="space-y-2">
          {checks.map((check, idx) => (
            <li
              key={check.id}
              className="flex items-start gap-2 rounded border border-neutral-200 bg-neutral-50 p-2"
            >
              <span className="mt-1 select-none text-xs text-neutral-400">
                {idx + 1}.
              </span>
              <input
                type="text"
                aria-label={`Question ${idx + 1}`}
                value={check.question}
                disabled={readOnly}
                onChange={(e) => handleEdit(check.id, e.target.value)}
                placeholder="What question must the draft answer?"
                className="flex-1 rounded border border-neutral-300 bg-white px-2 py-1 text-sm disabled:bg-neutral-100 disabled:text-neutral-500"
              />
              {!readOnly && (
                <button
                  type="button"
                  aria-label={`Remove check "${check.question || `question ${idx + 1}`}"`}
                  onClick={() => handleRemove(check.id)}
                  className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-600 hover:text-red-600"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ol>
      )}

      <button
        type="button"
        onClick={handleAdd}
        disabled={readOnly}
        className="self-start rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
      >
        + Add check
      </button>

      <div className="mt-2 flex flex-col gap-2 border-t border-neutral-200 pt-3 text-xs text-neutral-700">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            aria-label="Evaluate after every generation"
            checked={checksConfig.evaluateAfterEveryGeneration}
            disabled={readOnly}
            onChange={(e) =>
              onChecksConfigChange({
                ...checksConfig,
                evaluateAfterEveryGeneration: e.target.checked,
              })
            }
            className="mt-0.5"
          />
          <span>Evaluate after every generation</span>
        </label>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            aria-label="Block export if any check is missing"
            checked={checksConfig.blockExportIfMissing}
            disabled={readOnly}
            onChange={(e) =>
              onChecksConfigChange({
                ...checksConfig,
                blockExportIfMissing: e.target.checked,
              })
            }
            className="mt-0.5"
          />
          <span>Block export if any check is missing</span>
        </label>
      </div>
    </section>
  );
}

// Stable, URL-safe id. Falls back to a counter if randomUUID is unavailable
// (test envs / older runtimes). Check IDs are not security-sensitive —
// uniqueness within a document is the only requirement, and they must be
// stable across edits to other checks (ValidationReport keys reference them).
let counter = 0;
function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  counter += 1;
  return `check-${Date.now()}-${counter}`;
}
