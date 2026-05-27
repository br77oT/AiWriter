"use client";

import type { Template } from "@/lib/templates";

interface TemplatePickerModalProps {
  templates: Template[];
  busy: boolean;
  onCancel: () => void;
  onPick: (templateId: string) => void;
}

// Modal-style template picker. Used by ChecksPane "Load template" and by the
// TopBar selector when the user wants to swap templates on a non-empty doc.
// The "pick" callback returns the template id; the caller is responsible for
// the confirm-before-clobber dialog (handled at the Workspace level so the
// callsite can decide whether the doc is empty or not).
export function TemplatePickerModal({
  templates,
  busy,
  onCancel,
  onPick,
}: TemplatePickerModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-picker-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="flex w-full max-w-xl flex-col gap-3 rounded-lg bg-white p-5 shadow-xl">
        <h2 id="template-picker-title" className="text-base font-semibold">
          Load a template
        </h2>
        <p className="text-xs text-neutral-600">
          Opens a new document with this template. Your current document is
          left untouched.
        </p>
        <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {templates.length === 0 && (
            <li className="px-2 py-1 text-sm text-neutral-400">
              No templates available.
            </li>
          )}
          {templates.map((t, i) => (
            <li key={t.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onPick(t.id)}
                aria-label={`Load template ${t.name}`}
                className="flex w-full items-start gap-3 rounded border border-neutral-200 bg-white px-3 py-2 text-left text-sm hover:bg-neutral-50 disabled:cursor-not-allowed disabled:bg-neutral-100"
              >
                {/* Numbered chip — a positional index, not a step or ranking,
                    so the styling is neutral (not the blue/green the
                    Getting-started guide uses for current/done state). */}
                <span
                  aria-hidden
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-[11px] font-semibold text-neutral-600"
                >
                  {i + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex w-full items-baseline justify-between gap-2">
                    <span className="font-medium">{t.name}</span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-neutral-400">
                      {t.builtIn ? "Built-in" : "Saved"}
                    </span>
                  </span>
                  {/* Description + audience pulled straight from the template's
                      Spec, so user-saved templates that never set those fields
                      just collapse the row to the name. */}
                  {t.bundle.spec.goal && (
                    <span className="text-xs text-neutral-600">
                      {t.bundle.spec.goal}
                    </span>
                  )}
                  {t.bundle.spec.audience && (
                    <span className="text-xs text-neutral-500">
                      For: {t.bundle.spec.audience}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-100"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
