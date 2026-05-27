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
  // Saves the current document (outline + spec + checks + draft) as a
  // reusable template. Omitted in reviewer mode.
  onSaveAsTemplate?: () => void;
  // Disable the Save-as-template button when the document is empty. Mirrors
  // the same prop on TopBar so both entry points show consistent state.
  canSaveAsTemplate?: boolean;
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
  onSaveAsTemplate,
  canSaveAsTemplate = false,
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
    patch: {
      heading?: string;
      description?: string;
      required?: boolean;
      format?: OutlineSection["format"];
    }
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
      id="pane-outline"
      className="flex h-full flex-col gap-3 overflow-y-auto border-r border-[color:var(--border-subtle)] bg-white p-4"
      aria-labelledby="outline-pane-heading"
    >
      <div className="flex items-center gap-2">
        <h2 id="outline-pane-heading" className="ds-pane-heading">
          Document Outline ({outline.length})
        </h2>
        {onToggleCollapse && (
          <CollapseButton label="Document Outline" onCollapse={onToggleCollapse} />
        )}
      </div>
      <p
        data-testid="outline-pane-description"
        className="-mt-2 text-xs text-[color:var(--text-tertiary)]"
      >
        The document&apos;s section structure. Add, reorder or remove sections —
        each one becomes a numbered prompt in the Draft pane.
      </p>
      {!readOnly && onSaveAsTemplate && (
        <button
          type="button"
          data-testid="outline-save-as-template"
          onClick={onSaveAsTemplate}
          disabled={!canSaveAsTemplate}
          title={
            canSaveAsTemplate
              ? "Save the current outline, spec, checks, and draft as a reusable template."
              : "Add at least one outline section, check, or spec field to save as template."
          }
          className="ds-btn-secondary -mt-1 self-start"
        >
          Save as template…
        </button>
      )}
      <label className="-mt-2 flex items-center gap-1 text-xs text-[color:var(--text-secondary)]">
        <input
          type="checkbox"
          aria-label="Freeze outline"
          checked={outlineFrozen}
          disabled={readOnly}
          onChange={(e) => onFrozenChange(e.target.checked)}
        />
        Freeze
      </label>

      {outline.length === 0 ? (
        <p className="text-sm text-[color:var(--text-tertiary)]">
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
              className="ds-list-item"
            >
              <div className="flex items-start gap-2">
                <span className="mt-2 select-none text-xs text-[color:var(--text-tertiary)]">
                  {idx + 1}.
                </span>
                <div className="flex flex-1 flex-col gap-1.5">
                  <input
                    type="text"
                    aria-label={`Heading for section ${idx + 1}`}
                    value={section.heading}
                    disabled={lockEdits}
                    onChange={(e) =>
                      handlePatch(section.id, { heading: e.target.value })
                    }
                    placeholder="Section heading"
                    className="ds-input w-full font-medium"
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
                    className="ds-input ds-input--sm w-full"
                  />
                </div>
              </div>

              <div className="mt-2 text-xs text-[color:var(--text-secondary)]">
                <label className="flex items-center gap-1.5">
                  Format
                  <select
                    aria-label={`Format for ${section.heading || `section ${idx + 1}`}`}
                    value={section.format ?? "prose"}
                    disabled={readOnly}
                    onChange={(e) =>
                      handlePatch(section.id, {
                        format: e.target.value as
                          | "prose"
                          | "bullets"
                          | "numbered",
                      })
                    }
                    className="ds-select ds-select--sm"
                  >
                    <option value="prose">Prose</option>
                    <option value="bullets">Bullets</option>
                    <option value="numbered">Numbered</option>
                  </select>
                </label>
              </div>

              <div className="mt-2 flex items-center gap-2 text-xs text-[color:var(--text-secondary)]">
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
                    className="ds-btn-secondary ds-btn-secondary--xs"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move section ${section.heading || idx + 1} down`}
                    disabled={lockEdits || idx === outline.length - 1}
                    onClick={() => handleMove(idx, idx + 1)}
                    className="ds-btn-secondary ds-btn-secondary--xs"
                  >
                    ↓
                  </button>
                </span>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <span
                  className="ds-pill"
                  style={
                    section.required
                      ? {
                          backgroundColor: "var(--primary-soft)",
                          color: "var(--primary)",
                        }
                      : {
                          backgroundColor: "var(--surface-sunken)",
                          color: "var(--text-secondary)",
                        }
                  }
                >
                  {section.required ? "Required" : "Optional"}
                </span>
                <button
                  type="button"
                  aria-label={`Remove section ${section.heading || idx + 1}`}
                  disabled={lockEdits}
                  onClick={() => handleRemove(section.id)}
                  className="ds-btn-danger ds-btn-danger--xs ml-auto"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <button
        type="button"
        onClick={handleAdd}
        disabled={lockEdits}
        className="ds-btn-soft self-start"
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
