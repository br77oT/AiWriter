"use client";

import { useState } from "react";
import type { OutlineSection } from "@/lib/types";
import {
  addSection,
  removeSection,
  updateSection,
  moveSection,
} from "@/lib/outline";
import { CollapseButton, CollapsedStrip } from "./CollapsiblePane";

interface OutlinePaneProps {
  outline: OutlineSection[];
  outlineFrozen: boolean;
  onOutlineChange: (next: OutlineSection[]) => void;
  onFrozenChange: (next: boolean) => void;
  readOnly?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

// Controlled component: never owns outline state. Workspace holds the
// document and persists. Drag-and-drop reorder uses native HTML5 DnD;
// up/down buttons are exposed for keyboard a11y and for tests (jsdom DnD
// simulation is unreliable, and PRD §"Outline editor logic" calls out the
// model-layer reorder test as the source of truth for ordering correctness).
export function OutlinePane({
  outline,
  outlineFrozen,
  onOutlineChange,
  onFrozenChange,
  readOnly = false,
  collapsed = false,
  onToggleCollapse,
}: OutlinePaneProps) {
  // Reviewer mode is at least as restrictive as outline-frozen: no edits, no
  // reorder, no add/remove, freeze toggle itself is disabled.
  const lockEdits = outlineFrozen || readOnly;
  const [dragId, setDragId] = useState<string | null>(null);

  function handleAdd() {
    onOutlineChange(
      addSection(
        outline,
        { id: makeId(), heading: "", description: "", required: true },
        { frozen: outlineFrozen }
      )
    );
  }

  function handleRemove(id: string) {
    onOutlineChange(removeSection(outline, id, { frozen: outlineFrozen }));
  }

  function handlePatch(
    id: string,
    patch: { heading?: string; description?: string; required?: boolean }
  ) {
    onOutlineChange(
      updateSection(outline, id, patch, { frozen: outlineFrozen })
    );
  }

  function handleMove(fromIndex: number, toIndex: number) {
    onOutlineChange(
      moveSection(outline, fromIndex, toIndex, { frozen: outlineFrozen })
    );
  }

  function handleDragStart(id: string) {
    if (lockEdits) return;
    setDragId(id);
  }

  function handleDrop(targetId: string) {
    if (lockEdits || dragId == null || dragId === targetId) {
      setDragId(null);
      return;
    }
    const from = outline.findIndex((s) => s.id === dragId);
    const to = outline.findIndex((s) => s.id === targetId);
    setDragId(null);
    if (from === -1 || to === -1) return;
    handleMove(from, to);
  }

  if (collapsed && onToggleCollapse) {
    return <CollapsedStrip label="Document Outline" onExpand={onToggleCollapse} />;
  }

  return (
    <section
      className="flex h-full flex-col gap-3 overflow-y-auto border-r border-neutral-200 bg-white p-3"
      aria-labelledby="outline-pane-heading"
    >
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <h2
            id="outline-pane-heading"
            className="text-sm font-semibold uppercase tracking-wide text-neutral-600"
          >
            Document Outline
          </h2>
          {onToggleCollapse && (
            <CollapseButton label="Document Outline" onCollapse={onToggleCollapse} />
          )}
        </div>
        <label className="flex items-center gap-1 text-xs text-neutral-600">
          <input
            type="checkbox"
            aria-label="Freeze outline"
            checked={outlineFrozen}
            disabled={readOnly}
            onChange={(e) => onFrozenChange(e.target.checked)}
          />
          Freeze
        </label>
      </div>
      <p
        data-testid="outline-pane-description"
        className="-mt-2 text-xs text-neutral-500"
      >
        The document&apos;s section structure. Add, reorder or remove sections —
        each one becomes a numbered prompt in the Draft pane.
      </p>

      {outline.length === 0 ? (
        <p className="text-sm text-neutral-400">
          No sections yet. Click <span className="font-medium">Add section</span>{" "}
          to start building the outline.
        </p>
      ) : (
        <ol className="space-y-3">
          {outline.map((section, idx) => (
            <li
              key={section.id}
              draggable={!lockEdits}
              onDragStart={() => handleDragStart(section.id)}
              onDragOver={(e) => {
                if (!lockEdits) e.preventDefault();
              }}
              onDrop={() => handleDrop(section.id)}
              className="rounded border border-neutral-200 bg-neutral-50 p-2"
            >
              <div className="flex items-start gap-2">
                <span className="mt-1 select-none text-xs text-neutral-400">
                  {idx + 1}.
                </span>
                <div className="flex flex-1 flex-col gap-1">
                  <input
                    type="text"
                    aria-label={`Heading for section ${idx + 1}`}
                    value={section.heading}
                    disabled={lockEdits}
                    onChange={(e) =>
                      handlePatch(section.id, { heading: e.target.value })
                    }
                    placeholder="Section heading"
                    className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm font-medium disabled:bg-neutral-100 disabled:text-neutral-500"
                  />
                  <input
                    type="text"
                    aria-label={`Description for ${section.heading || `section ${idx + 1}`}`}
                    value={section.description}
                    disabled={readOnly}
                    onChange={(e) =>
                      handlePatch(section.id, { description: e.target.value })
                    }
                    placeholder="Short description (used as a hint by Generation)"
                    className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 disabled:bg-neutral-100 disabled:text-neutral-500"
                  />
                </div>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                    section.required
                      ? "bg-neutral-800 text-white"
                      : "bg-neutral-200 text-neutral-700"
                  }`}
                >
                  {section.required ? "Required" : "Optional"}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-2 text-xs text-neutral-600">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    aria-label={`Required for ${section.heading || `section ${idx + 1}`}`}
                    checked={section.required}
                    disabled={readOnly}
                    onChange={(e) =>
                      handlePatch(section.id, { required: e.target.checked })
                    }
                  />
                  Required
                </label>
                <span className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Move section ${section.heading || idx + 1} up`}
                    disabled={lockEdits || idx === 0}
                    onClick={() => handleMove(idx, idx - 1)}
                    className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-xs hover:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move section ${section.heading || idx + 1} down`}
                    disabled={lockEdits || idx === outline.length - 1}
                    onClick={() => handleMove(idx, idx + 1)}
                    className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-xs hover:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove section ${section.heading || idx + 1}`}
                    disabled={lockEdits}
                    onClick={() => handleRemove(section.id)}
                    className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-xs text-neutral-600 hover:text-red-600 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
                  >
                    Remove
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}

      <button
        type="button"
        onClick={handleAdd}
        disabled={lockEdits}
        className="self-start rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
      >
        + Add section
      </button>
    </section>
  );
}

// Stable, URL-safe id. Falls back to a counter if randomUUID is unavailable
// (test envs or older runtimes). Outline sections are not security-sensitive
// — uniqueness within a document is the only requirement.
let counter = 0;
function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  counter += 1;
  return `outline-${Date.now()}-${counter}`;
}
