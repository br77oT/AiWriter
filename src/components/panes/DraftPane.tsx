"use client";

import type { Document } from "@/lib/types";

interface DraftPaneProps {
  document: Document;
  onDraftSectionChange: (outlineId: string, text: string) => void;
}

// Slice 002: minimal per-section editor so the validation rail's incremental
// re-run on draft edits has something to react to. The full draft editor and
// section-level Generate / Lock / Rewrite affordances arrive in slices 006–007.
export function DraftPane({ document, onDraftSectionChange }: DraftPaneProps) {
  const sections = document.outline;

  return (
    <section
      className="flex h-full flex-col overflow-y-auto border-r border-neutral-200 bg-white p-3"
      aria-labelledby="draft-pane-heading"
    >
      <h2
        id="draft-pane-heading"
        className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-600"
      >
        Draft
      </h2>

      {sections.length === 0 ? (
        <p className="text-sm text-neutral-400">
          Outline is empty — load a fixture from the top bar (dev) or build the
          outline (slice 004) to start editing draft sections.
        </p>
      ) : (
        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section.id}>
              <label className="mb-1 block text-sm font-medium text-neutral-800">
                {section.heading}
                {!section.required && (
                  <span className="ml-1 text-xs text-neutral-400">
                    (optional)
                  </span>
                )}
              </label>
              <textarea
                aria-label={`Draft text for ${section.heading}`}
                className="min-h-[6rem] w-full rounded border border-neutral-300 p-2 text-sm leading-relaxed"
                value={document.draftSections[section.id] ?? ""}
                onChange={(e) =>
                  onDraftSectionChange(section.id, e.target.value)
                }
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
