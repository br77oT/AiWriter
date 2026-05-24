"use client";

import type { Document } from "@/lib/types";
import { CollapseButton, CollapsedStrip } from "./CollapsiblePane";

interface AssembledDraftPaneProps {
  document: Document;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

// Read-only stitched view of the document: every outline section in order,
// heading + prose. Sits in its own pane so the user can put it side-by-side
// with the Draft (numbered prompts) or the Outline. Same collapsible shell as
// the Spec / Outline / Checks panes.
export function AssembledDraftPane({
  document,
  collapsed = false,
  onToggleCollapse,
}: AssembledDraftPaneProps) {
  if (collapsed && onToggleCollapse) {
    return <CollapsedStrip label="Assembled" onExpand={onToggleCollapse} />;
  }
  return (
    <section
      data-testid="assembled-draft-pane"
      className="flex h-full flex-col gap-3 overflow-y-auto border-r border-neutral-200 bg-white p-3"
      aria-labelledby="assembled-draft-heading"
    >
      <div className="flex items-center gap-2">
        <h2
          id="assembled-draft-heading"
          className="text-sm font-semibold uppercase tracking-wide text-neutral-600"
        >
          Assembled draft
        </h2>
        {onToggleCollapse && (
          <CollapseButton
            label="Assembled draft"
            onCollapse={onToggleCollapse}
          />
        )}
      </div>
      <p
        data-testid="assembled-draft-description"
        className="-mt-1 text-xs text-neutral-500"
      >
        The final draft, stitched together from the numbered prompts in the
        Draft pane. Edit a prompt or click Generate Draft to update it.
      </p>
      {document.outline.length === 0 ? (
        <p className="text-sm text-neutral-400">
          Outline is empty — add sections to see the assembled draft here.
        </p>
      ) : (
        <div
          data-testid="assembled-draft"
          className="space-y-3 rounded border border-neutral-200 bg-neutral-50 p-3 text-sm leading-relaxed text-neutral-800"
        >
          {document.outline.map((section) => {
            const text = (document.draftSections[section.id] ?? "").trim();
            return (
              <div key={section.id}>
                <p className="text-sm font-semibold text-neutral-900">
                  {section.heading}
                </p>
                {text === "" ? (
                  <p className="italic text-neutral-400">(empty)</p>
                ) : (
                  <p className="whitespace-pre-wrap">{text}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
