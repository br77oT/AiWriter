"use client";

import type { Document } from "@/lib/types";

interface DraftPaneProps {
  document: Document;
  onDraftSectionChange: (outlineId: string, text: string) => void;
  onLockToggle: (outlineId: string, locked: boolean) => void;
  onRewrite: (outlineId: string) => void;
  onExpand: (outlineId: string) => void;
}

// Per-section editor with Slice 007 affordances:
// - Lock checkbox per section. Locked sections are skipped by full-draft
//   regeneration and disabled in the rewrite/expand path (PRD §"Lock
//   semantics are hard").
// - Rewrite + Expand buttons open the Section Rewrite Modal preset for the
//   appropriate mode.
export function DraftPane({
  document,
  onDraftSectionChange,
  onLockToggle,
  onRewrite,
  onExpand,
}: DraftPaneProps) {
  const sections = document.outline;
  const lockedIds = new Set(document.lockedSectionIds);

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
          {sections.map((section) => {
            const locked = lockedIds.has(section.id);
            return (
              <div key={section.id}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="text-sm font-medium text-neutral-800">
                    {section.heading}
                    {!section.required && (
                      <span className="ml-1 text-xs text-neutral-400">
                        (optional)
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      aria-label={`Rewrite section "${section.heading}"`}
                      disabled={locked}
                      onClick={() => onRewrite(section.id)}
                      className="rounded border border-neutral-300 bg-white px-2 py-0.5 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
                    >
                      Rewrite
                    </button>
                    <button
                      type="button"
                      aria-label={`Expand section "${section.heading}"`}
                      disabled={locked}
                      onClick={() => onExpand(section.id)}
                      className="rounded border border-neutral-300 bg-white px-2 py-0.5 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
                    >
                      Expand
                    </button>
                    <label className="flex items-center gap-1 text-neutral-600">
                      <input
                        type="checkbox"
                        aria-label={`Lock section "${section.heading}"`}
                        checked={locked}
                        onChange={(e) =>
                          onLockToggle(section.id, e.target.checked)
                        }
                      />
                      Lock
                    </label>
                  </div>
                </div>
                <textarea
                  aria-label={`Draft text for ${section.heading}`}
                  className="min-h-[6rem] w-full rounded border border-neutral-300 p-2 text-sm leading-relaxed disabled:bg-neutral-100 disabled:text-neutral-500"
                  value={document.draftSections[section.id] ?? ""}
                  disabled={locked}
                  onChange={(e) =>
                    onDraftSectionChange(section.id, e.target.value)
                  }
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
