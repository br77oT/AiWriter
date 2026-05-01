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
      <div className="flex w-full max-w-md flex-col gap-3 rounded-lg bg-white p-5 shadow-xl">
        <h2 id="template-picker-title" className="text-base font-semibold">
          Load a template
        </h2>
        <p className="text-xs text-neutral-600">
          Loading a template replaces Spec, Outline, and Checks.
        </p>
        <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {templates.length === 0 && (
            <li className="px-2 py-1 text-sm text-neutral-400">
              No templates available.
            </li>
          )}
          {templates.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onPick(t.id)}
                aria-label={`Load template ${t.name}`}
                className="flex w-full items-center justify-between rounded border border-neutral-200 bg-white px-3 py-2 text-left text-sm hover:bg-neutral-50 disabled:cursor-not-allowed disabled:bg-neutral-100"
              >
                <span className="font-medium">{t.name}</span>
                <span className="text-[10px] uppercase tracking-wide text-neutral-400">
                  {t.builtIn ? "Built-in" : "Saved"}
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
