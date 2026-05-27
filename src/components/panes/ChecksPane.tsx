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
    return <CollapsedStrip label="Validation Checks" onExpand={onToggleCollapse} />;
  }

  return (
    <section
      className="flex h-full flex-col gap-3 overflow-y-auto border-r border-[color:var(--border-subtle)] bg-white p-4"
      aria-labelledby="checks-pane-heading"
    >
      <div className="flex items-center gap-2">
        <h2 id="checks-pane-heading" className="ds-pane-heading">
          Validation Checks ({checks.length})
        </h2>
        {onToggleCollapse && (
          <CollapseButton label="Validation Checks" onCollapse={onToggleCollapse} />
        )}
      </div>
      <p
        data-testid="checks-pane-description"
        className="-mt-2 text-xs text-[color:var(--text-tertiary)]"
      >
        Questions the finished draft must answer. Validation grades each one
        and highlights gaps in the rail on the right.
      </p>
      <button
        type="button"
        onClick={onLoadTemplate}
        disabled={readOnly}
        className="ds-btn-secondary ds-btn-secondary--xs -mt-2 self-start"
      >
        Load template
      </button>

      {checks.length === 0 ? (
        <p className="text-sm text-[color:var(--text-tertiary)]">
          No checks yet. Click <span className="font-medium">Add check</span> to
          add a question the draft must answer.
        </p>
      ) : (
        <ol className="space-y-2">
          {checks.map((check, idx) => (
            <li key={check.id} className="ds-list-item min-w-0">
              <div className="flex min-w-0 items-start gap-2">
                <span className="mt-2 select-none text-xs text-[color:var(--text-tertiary)]">
                  {idx + 1}.
                </span>
                <input
                  type="text"
                  aria-label={`Question ${idx + 1}`}
                  value={check.question}
                  disabled={readOnly}
                  onChange={(e) => handleEdit(check.id, e.target.value)}
                  placeholder="What question must the draft answer?"
                  className="ds-input ds-input--sm min-w-0 flex-1"
                />
              </div>
              {!readOnly && (
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    aria-label={`Remove check "${check.question || `question ${idx + 1}`}"`}
                    onClick={() => handleRemove(check.id)}
                    className="ds-btn-danger ds-btn-danger--xs"
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      <button
        type="button"
        onClick={handleAdd}
        disabled={readOnly}
        className="ds-btn-soft self-start"
      >
        + Add check
      </button>

      <div className="mt-2 flex flex-col gap-2 border-t border-[color:var(--border-subtle)] pt-3 text-xs text-[color:var(--text-secondary)]">
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
