"use client";

import { useState } from "react";
import type { Spec } from "@/lib/types";
import { CollapseButton, CollapsedStrip } from "./CollapsiblePane";

interface SpecPaneProps {
  spec: Spec;
  onSpecChange: (next: Spec) => void;
  readOnly?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function SpecPane({
  spec,
  onSpecChange,
  readOnly = false,
  collapsed = false,
  onToggleCollapse,
}: SpecPaneProps) {
  if (collapsed && onToggleCollapse) {
    return <CollapsedStrip label="Tone and Purpose" onExpand={onToggleCollapse} />;
  }

  return (
    <section
      className="flex h-full flex-col gap-4 overflow-y-auto border-r border-neutral-200 bg-white p-3"
      aria-labelledby="spec-pane-heading"
    >
      <div className="flex items-center justify-between">
        <h2
          id="spec-pane-heading"
          className="text-sm font-semibold uppercase tracking-wide text-neutral-600"
        >
          Tone and Purpose
        </h2>
        {onToggleCollapse && (
          <CollapseButton label="Tone and Purpose" onCollapse={onToggleCollapse} />
        )}
      </div>
      <p
        data-testid="spec-pane-description"
        className="-mt-2 text-xs text-neutral-500"
      >
        What the document is about — goal, tone, audience, and content the
        draft must include or avoid.
      </p>

      <Field label="Goal" htmlFor="spec-goal">
        <textarea
          id="spec-goal"
          className="min-h-[5rem] w-full rounded border border-neutral-300 p-2 text-sm leading-relaxed disabled:bg-neutral-100 disabled:text-neutral-500"
          value={spec.goal}
          disabled={readOnly}
          onChange={(e) => onSpecChange({ ...spec, goal: e.target.value })}
        />
      </Field>

      <Field label="Tone" htmlFor="spec-tone">
        <textarea
          id="spec-tone"
          className="min-h-[4rem] w-full rounded border border-neutral-300 p-2 text-sm leading-relaxed disabled:bg-neutral-100 disabled:text-neutral-500"
          value={spec.tone}
          disabled={readOnly}
          onChange={(e) => onSpecChange({ ...spec, tone: e.target.value })}
        />
      </Field>

      <Field label="Audience" htmlFor="spec-audience">
        <input
          id="spec-audience"
          type="text"
          className="w-full rounded border border-neutral-300 p-2 text-sm disabled:bg-neutral-100 disabled:text-neutral-500"
          value={spec.audience}
          disabled={readOnly}
          onChange={(e) =>
            onSpecChange({ ...spec, audience: e.target.value })
          }
        />
      </Field>

      <ListEditor
        label="Must include"
        kind="must-include"
        items={spec.mustInclude}
        readOnly={readOnly}
        onChange={(next) => onSpecChange({ ...spec, mustInclude: next })}
      />

      <ListEditor
        label="Must avoid"
        kind="must-avoid"
        items={spec.mustAvoid}
        readOnly={readOnly}
        onChange={(next) => onSpecChange({ ...spec, mustAvoid: next })}
      />
    </section>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

interface ListEditorProps {
  label: string;
  kind: "must-include" | "must-avoid";
  items: string[];
  readOnly: boolean;
  onChange: (next: string[]) => void;
}

function ListEditor({ label, kind, items, readOnly, onChange }: ListEditorProps) {
  const [draft, setDraft] = useState("");

  function add() {
    if (readOnly) return;
    const trimmed = draft.trim();
    if (!trimmed) return;
    onChange([...items, trimmed]);
    setDraft("");
  }

  return (
    <div>
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      {items.length === 0 ? (
        <p className="mb-2 text-sm text-neutral-400">No items.</p>
      ) : (
        <ul className="mb-2 space-y-1">
          {items.map((item, idx) => (
            <li
              key={`${idx}-${item}`}
              className="flex items-center gap-2 rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm"
            >
              <span className="flex-1 break-words">{item}</span>
              {!readOnly && (
                <button
                  type="button"
                  aria-label={`Remove ${kind} "${item}"`}
                  onClick={() => onChange(items.filter((_, i) => i !== idx))}
                  className="text-xs text-neutral-500 hover:text-red-600"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        // flex-wrap so the Add button drops to a new line if the input + button
        // don't fit on one row at the current pane width. `min-w-0` on the
        // input lets it shrink past its intrinsic content size; `min-w-[8rem]`
        // keeps it usably wide before the button wraps.
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            aria-label={`New ${kind} item`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            className="min-w-[8rem] flex-1 rounded border border-neutral-300 px-2 py-1 text-sm"
            placeholder={kind === "must-include" ? "Add a rule…" : "Add a phrase…"}
          />
          <button
            type="button"
            aria-label={`Add ${kind} item`}
            onClick={add}
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm hover:bg-neutral-100"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
