"use client";

import type { Document } from "@/lib/types";
import { CollapseButton, CollapsedStrip } from "./CollapsiblePane";

interface AssembledDraftPaneProps {
  document: Document;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  // Reveals the Validation rail + Statistics group. Omitted in reviewer mode
  // (no mutating actions / validation runs in that mode).
  onCheckValidations?: () => void;
}

// Read-only stitched view of the document: every outline section in order,
// heading + prose. Sits in its own pane so the user can put it side-by-side
// with the Draft (numbered prompts) or the Outline. Same collapsible shell as
// the Spec / Outline / Checks panes.
export function AssembledDraftPane({
  document,
  collapsed = false,
  onToggleCollapse,
  onCheckValidations,
}: AssembledDraftPaneProps) {
  if (collapsed && onToggleCollapse) {
    return <CollapsedStrip label="Generated" onExpand={onToggleCollapse} />;
  }
  return (
    <section
      id="pane-assembled"
      data-testid="assembled-draft-pane"
      className="flex h-full flex-col gap-3 overflow-y-auto border-r border-[color:var(--border-subtle)] bg-white p-4"
      aria-labelledby="assembled-draft-heading"
    >
      <div className="flex items-center gap-2">
        <h2 id="assembled-draft-heading" className="ds-pane-heading">
          Generated draft
        </h2>
        {onToggleCollapse && (
          <CollapseButton
            label="Generated draft"
            onCollapse={onToggleCollapse}
          />
        )}
      </div>
      <p
        data-testid="assembled-draft-description"
        className="-mt-1 text-xs text-[color:var(--text-tertiary)]"
      >
        The final draft, stitched together from the numbered prompts in the
        Draft pane. Edit a prompt or click Generate Draft to update it.
      </p>
      {onCheckValidations && (
        <div className="flex justify-end">
          <button
            type="button"
            data-testid="assembled-check-validations"
            onClick={onCheckValidations}
            title="Open the Validation rail and Statistics panel."
            className="ds-btn-secondary"
          >
            <span>Check validations</span>
            {/* Arrow points right — the Validation rail + Stats sit to the
                right of Assembled on desktop. aria-hidden so the screen
                reader only hears "Check validations". */}
            <span aria-hidden="true" className="text-[color:var(--text-tertiary)]">
              →
            </span>
          </button>
        </div>
      )}
      {document.outline.length === 0 ? (
        <p className="text-sm text-neutral-400">
          Outline is empty — add sections to see the generated draft here.
        </p>
      ) : (
        <div
          data-testid="assembled-draft"
          className="space-y-3 rounded-[var(--radius-control)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-sunken)] p-4 text-sm leading-relaxed text-[color:var(--text-primary)]"
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
