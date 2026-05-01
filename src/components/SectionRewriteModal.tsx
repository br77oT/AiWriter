"use client";

import { useState } from "react";
import type { PreserveFlags, SectionMode } from "@/lib/generation";

interface SectionRewriteModalProps {
  sectionHeading: string;
  mode: SectionMode;
  busy?: boolean;
  onCancel: () => void;
  onSubmit: (payload: {
    instruction: string;
    preserve: PreserveFlags;
  }) => void;
}

// Section rewrite/expand modal per `prd/make ux wireframes.md` "Section
// rewrite modal". Same component for both modes — the mode flag drives the
// title and the submit button label, and the prompt-side preserve toggles
// default to all-on per the wireframe.
export function SectionRewriteModal({
  sectionHeading,
  mode,
  busy = false,
  onCancel,
  onSubmit,
}: SectionRewriteModalProps) {
  const [instruction, setInstruction] = useState("");
  const [preserve, setPreserve] = useState<PreserveFlags>({
    heading: true,
    facts: true,
    tone: true,
    otherSections: true,
  });

  const verb = mode === "expand" ? "Expand" : "Rewrite";
  const busyVerb = mode === "expand" ? "Expanding…" : "Rewriting…";

  function setFlag(key: keyof PreserveFlags, value: boolean) {
    setPreserve((p) => ({ ...p, [key]: value }));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="section-rewrite-heading"
    >
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="border-b border-neutral-200 px-4 py-3">
          <h2
            id="section-rewrite-heading"
            className="text-base font-semibold text-neutral-900"
          >
            {verb} section: {sectionHeading}
          </h2>
        </div>

        <div className="space-y-3 px-4 py-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-800">
              Instruction
            </span>
            <textarea
              aria-label="Instruction"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={
                mode === "expand"
                  ? "Add operational impact and mention which teams were blocked."
                  : "Tighten the prose and remove speculation."
              }
              className="min-h-[5rem] w-full rounded border border-neutral-300 p-2 text-sm"
            />
          </label>

          <fieldset className="rounded border border-neutral-200 px-3 py-2">
            <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
              Preserve
            </legend>
            <div className="mt-1 flex flex-col gap-1 text-sm text-neutral-800">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={preserve.heading}
                  onChange={(e) => setFlag("heading", e.target.checked)}
                />
                Heading text
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={preserve.facts}
                  onChange={(e) => setFlag("facts", e.target.checked)}
                />
                Factual claims already present
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={preserve.tone}
                  onChange={(e) => setFlag("tone", e.target.checked)}
                />
                Tone and style
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={preserve.otherSections}
                  onChange={(e) => setFlag("otherSections", e.target.checked)}
                />
                Do not edit other sections
              </label>
            </div>
          </fieldset>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-neutral-200 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100 disabled:bg-neutral-100 disabled:text-neutral-400"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit({ instruction, preserve })}
            disabled={busy}
            className="rounded border border-neutral-800 bg-neutral-900 px-3 py-1 text-sm text-white hover:bg-neutral-800 disabled:bg-neutral-600"
          >
            {busy ? busyVerb : verb}
          </button>
        </div>
      </div>
    </div>
  );
}
