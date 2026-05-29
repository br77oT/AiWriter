"use client";

import type { ReactNode } from "react";
import type { Document, OutlineSection } from "@/lib/types";

interface DraftPaneProps {
  document: Document;
  onDraftSectionChange: (outlineId: string, text: string) => void;
  onLockToggle: (outlineId: string, locked: boolean) => void;
  onRewrite: (outlineId: string) => void;
  onExpand: (outlineId: string) => void;
  // Optional in reviewer mode (no Generate buttons rendered there).
  onGenerate?: () => void;
  generating?: boolean;
  canGenerate?: boolean;
  readOnly?: boolean;
  // Reveals the Document Outline pane (where the per-section prompts live)
  // and focuses it. Omitted in reviewer mode.
  onEditPrompts?: () => void;
  // Ids of sections marked Required whose heading is still blank. Rendered
  // as a red "Heading needed" indicator next to the prompt so the user
  // knows what to fix before Generate Draft will run.
  incompleteRequiredIds?: string[];
  // Ids of sections marked Required whose draft textarea is still empty.
  // Shown as a red "Fill in to generate" indicator so the user knows which
  // textareas need content before Generate Draft will run.
  requiredEmptyDraftIds?: string[];
  // Live per-section progress for an in-flight Generate run. `null` when
  // no run is active.
  generationProgress?: {
    index: number;
    total: number;
    heading: string;
  } | null;
  // Status badges keyed by outlineId. Missing keys render no badge.
  sectionStatuses?: Record<string, "writing" | "done" | "error" | "skipped">;
  // Click handler for the inline Cancel button shown next to "Generating".
  // Omitted when no Generate run is in flight (or in reviewer mode).
  onCancelGenerate?: () => void;
}

// Per-section editor with Slice 007 affordances:
// - Lock checkbox per section. Locked sections are skipped by full-draft
//   regeneration and disabled in the rewrite/expand path (PRD §"Lock
//   semantics are hard").
// - Rewrite + Expand buttons open the Section Rewrite Modal preset for the
//   appropriate mode.
// - Generate Draft buttons at top + bottom so the action is reachable
//   without scrolling whichever direction the user is currently moving.
// The stitched read-only view lives in its own AssembledDraftPane so users
// can put it side-by-side with the Outline or any other pane.
export function DraftPane({
  document,
  onDraftSectionChange,
  onLockToggle,
  onRewrite,
  onExpand,
  onGenerate,
  generating = false,
  canGenerate = false,
  readOnly = false,
  onEditPrompts,
  incompleteRequiredIds = [],
  requiredEmptyDraftIds = [],
  generationProgress = null,
  sectionStatuses = {},
  onCancelGenerate,
}: DraftPaneProps) {
  const sections = document.outline;
  const lockedIds = new Set(document.lockedSectionIds);
  const incompleteSet = new Set(incompleteRequiredIds);
  const emptyDraftSet = new Set(requiredEmptyDraftIds);
  const showGenerate = !readOnly && Boolean(onGenerate);
  const showEditPrompts = !readOnly && Boolean(onEditPrompts);
  // While Generate is streaming the whole pane goes read-only — the run
  // mutates draftSections live, so accepting keystrokes would race the
  // server's section-done events. Per ADR 0001.
  const streaming = generating;

  return (
    <section
      className="flex h-full flex-col overflow-y-auto border-r border-[color:var(--border-subtle)] bg-white p-4"
      aria-labelledby="draft-pane-heading"
    >
      <h2 id="draft-pane-heading" className="ds-pane-heading mb-2">
        Draft
      </h2>

      {showGenerate && (
        <GenerateDraftButton
          position="top"
          generating={generating}
          canGenerate={canGenerate}
          onGenerate={onGenerate!}
          extraButton={
            showEditPrompts ? (
              <button
                type="button"
                data-testid="draft-edit-prompts"
                onClick={onEditPrompts}
                title="Open the Document Outline pane to edit the per-section prompts."
                className="ds-btn-secondary"
              >
                Edit prompts
              </button>
            ) : null
          }
        />
      )}

      {streaming && generationProgress && (
        <div
          data-testid="draft-generation-progress"
          className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-[color:var(--primary-soft)] bg-[color:var(--primary-soft)]/40 px-3 py-2 text-xs text-[color:var(--primary)]"
        >
          <span
            aria-hidden
            className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[color:var(--primary-soft)] border-t-[color:var(--primary)]"
          />
          <span>
            Generating: {generationProgress.index + 1} of{" "}
            {generationProgress.total} —{" "}
            <span className="italic">{generationProgress.heading}</span>
          </span>
          {onCancelGenerate && (
            <button
              type="button"
              data-testid="draft-generate-cancel"
              onClick={onCancelGenerate}
              className="ml-auto rounded-[var(--radius-control)] border border-[color:var(--primary)] bg-white px-2 py-0.5 text-xs font-medium text-[color:var(--primary)] hover:bg-[color:var(--primary-soft)]"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {sections.length === 0 ? (
        <p className="text-sm text-neutral-400">
          Outline is empty — load a fixture from the top bar (dev) or build the
          outline (slice 004) to start editing draft sections.
        </p>
      ) : (
        <div className="space-y-4">
          {sections.map((section, index) => {
            const locked = lockedIds.has(section.id);
            const isEmpty =
              (document.draftSections[section.id] ?? "").trim() === "";
            const needsHeading = incompleteSet.has(section.id);
            const needsDraftText =
              !needsHeading && emptyDraftSet.has(section.id);
            return (
              <div key={section.id}>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <label className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-neutral-800">
                    <span
                      data-testid={`section-prompt-number-${section.id}`}
                      className="text-neutral-500"
                    >
                      {index + 1}.
                    </span>
                    {section.heading || (
                      <span className="italic text-neutral-400">
                        (untitled)
                      </span>
                    )}
                    <SectionStatusBadge
                      status={sectionStatuses[section.id]}
                      locked={locked}
                    />
                    {needsHeading ? (
                      <span
                        data-testid={`section-needs-heading-${section.id}`}
                        className="ds-pill ds-pill-danger"
                        title="This prompt is marked Required. Add a heading in the Document Outline pane before generating."
                      >
                        Heading required
                      </span>
                    ) : needsDraftText ? (
                      <span
                        data-testid={`section-needs-draft-${section.id}`}
                        className="ds-pill ds-pill-danger"
                        title="This prompt is marked Required. Write something in the textarea (or click Insert example) before Generate Draft will run."
                      >
                        Fill in to generate
                      </span>
                    ) : section.required ? (
                      <span
                        className="ds-pill"
                        style={{
                          backgroundColor: "var(--primary-soft)",
                          color: "var(--primary)",
                        }}
                      >
                        Required
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-400">
                        (optional)
                      </span>
                    )}
                  </label>
                  {!readOnly && (
                    <div className="flex items-center gap-2 text-xs">
                      {isEmpty && (
                        <button
                          type="button"
                          aria-label={`Insert example text for section "${section.heading}"`}
                          disabled={locked || streaming}
                          onClick={() =>
                            onDraftSectionChange(
                              section.id,
                              exampleTextFor(section)
                            )
                          }
                          className="ds-btn-secondary ds-btn-secondary--xs"
                        >
                          Insert example
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={`Rewrite section "${section.heading}"`}
                        disabled={locked || streaming}
                        onClick={() => onRewrite(section.id)}
                        className="rounded border border-neutral-300 bg-white px-2 py-0.5 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
                      >
                        Rewrite
                      </button>
                      <button
                        type="button"
                        aria-label={`Expand section "${section.heading}"`}
                        disabled={locked || streaming}
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
                          disabled={streaming}
                          onChange={(e) =>
                            onLockToggle(section.id, e.target.checked)
                          }
                        />
                        Lock
                      </label>
                    </div>
                  )}
                </div>
                <textarea
                  aria-label={`Draft text for ${section.heading}`}
                  className="ds-textarea min-h-[6rem] w-full leading-relaxed"
                  value={document.draftSections[section.id] ?? ""}
                  disabled={locked || readOnly || streaming}
                  placeholder={
                    readOnly
                      ? undefined
                      : 'Write this section, or click "Insert example" for a starter you can fill in.'
                  }
                  onChange={(e) =>
                    onDraftSectionChange(section.id, e.target.value)
                  }
                />
              </div>
            );
          })}
        </div>
      )}

      {showGenerate && sections.length > 0 && (
        <GenerateDraftButton
          position="bottom"
          generating={generating}
          canGenerate={canGenerate}
          onGenerate={onGenerate!}
        />
      )}
    </section>
  );
}

function GenerateDraftButton({
  position,
  generating,
  canGenerate,
  onGenerate,
  extraButton,
}: {
  position: "top" | "bottom";
  generating: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
  // Optional sibling button rendered on the same row as Generate Draft
  // (top variant only). Used by DraftPane to host "Edit prompts" without
  // a separate header row.
  extraButton?: ReactNode;
}) {
  const isTop = position === "top";
  return (
    <div
      className={
        isTop
          ? "mb-3 flex flex-col items-start gap-2"
          : "mt-4 flex justify-end border-t border-neutral-200 pt-3"
      }
    >
      {isTop && (
        <p
          data-testid="draft-generate-explainer"
          className="text-xs text-neutral-500"
        >
          The numbered prompts below will be combined into a final draft.
        </p>
      )}
      <div className={isTop ? "flex flex-wrap items-center gap-2" : "contents"}>
        <button
          type="button"
          data-testid={`draft-generate-${position}`}
          onClick={onGenerate}
          disabled={generating || !canGenerate}
          title={
            canGenerate
              ? undefined
              : "Every Required prompt needs a heading and some text in its textarea before Generate Draft will run. Type something or click Insert example to seed it."
          }
          className="ds-btn-primary"
        >
          <span>{generating ? "Generating…" : "Generate Draft"}</span>
          {/* Right arrow on both buttons — the click sends the prompts to
              the Assembled draft pane on the right. aria-hidden so screen
              readers hear only "Generate Draft". */}
          <span aria-hidden="true" className="opacity-80">
            →
          </span>
        </button>
        {isTop && extraButton}
      </div>
    </div>
  );
}


// A worked example written out for the section, so the writer sees what a
// finished section looks like instead of facing an empty box or a list of
// instructions. Every example describes the same fictional incident (an
// expired-TLS-certificate checkout outage on 2026-03-12), so inserting
// examples across several sections produces one coherent draft to edit down.
const SECTION_EXAMPLES: Array<{ match: RegExp; text: string }> = [
  {
    match: /\b(summary|overview|tl;?dr|abstract)\b/i,
    text:
      "On 2026-03-12 the checkout service was unavailable for 23 minutes after " +
      "an expired TLS certificate blocked all calls to the payment gateway. " +
      "Customers could browse the store but could not complete a purchase " +
      "between 11:02 and 11:25. Service was restored by deploying a renewed " +
      "certificate, and no customer data was lost.",
  },
  {
    match: /\b(timeline|sequence|chronology)\b/i,
    text:
      "11:02 — payment gateway begins returning TLS handshake errors.\n" +
      "11:05 — automated alert pages the on-call engineer.\n" +
      "11:11 — on-call confirms the certificate expired at 11:00.\n" +
      "11:19 — renewed certificate deployed to the first region.\n" +
      "11:25 — all regions healthy; checkout fully restored.",
  },
  {
    match: /\broot[\s-]?cause|\bcause\b|\bwhy\b/i,
    text:
      "The TLS certificate for the payment gateway expired at 11:00 on " +
      "2026-03-12. It was renewed by hand once a year, the calendar reminder " +
      "for this year's renewal was never created, and the certificate lapsed " +
      "with no warning. Automated renewal was available but had not been " +
      "enabled for this service.",
  },
  {
    match: /\b(impact|affected|scope|consequence)\b/i,
    text:
      "Checkout was unavailable for 23 minutes. Roughly 1,800 customers could " +
      "not complete a purchase, and an estimated $42,000 in orders were " +
      "delayed — most customers retried successfully once service returned. " +
      "No customer data was exposed or lost.",
  },
  {
    match: /\b(action|follow[\s-]?up|next step|remediation|task)\b/i,
    text:
      "1. Enable automated certificate renewal for the payment gateway " +
      "(owner: priya, due 2026-03-19).\n" +
      "2. Audit every production certificate for expiry date and renewal " +
      "method (owner: sam, due 2026-03-26).\n" +
      "3. Add a monitor that alerts 30 days before any certificate expires " +
      "(owner: priya, due 2026-04-02).",
  },
  {
    match: /\b(background|context|introduction)\b/i,
    text:
      "The checkout service handles all customer payments and reaches an " +
      "external payment gateway over a TLS connection. Certificates for that " +
      "connection had historically been renewed by hand once a year by the " +
      "platform team, with no automated reminder or monitoring in place.",
  },
  {
    match: /\brecommend/i,
    text:
      "Move all certificate management to automated renewal and treat any " +
      "remaining manual renewal step as a reliability risk. Until that is " +
      "complete, track every certificate's expiry date on a shared dashboard " +
      "reviewed weekly.",
  },
  {
    match: /\b(conclusion|closing|wrap[\s-]?up)\b/i,
    text:
      "A single expired certificate caused a short but costly checkout " +
      "outage. The fix is straightforward — automated renewal plus expiry " +
      "monitoring — and once both are in place this class of failure should " +
      "not happen again.",
  },
  {
    match: /\b(appendix|reference|supporting)\b/i,
    text:
      "Supporting material: alert logs from 11:02–11:25, the certificate " +
      "metadata showing the 11:00 expiry, and the deploy record for the " +
      "renewed certificate. Replace these with the links or attachments for " +
      "your own incident.",
  },
];

// Inserted as real draft text (not a textarea placeholder) so it persists,
// gets validated, and can be reshaped in place. Matches the section heading
// against SECTION_EXAMPLES; falls back to a generic worked example for
// headings we don't recognise.
// Per-section progress badge for an in-flight Generate run. Reads the
// status keyed by outlineId; renders nothing when there's no entry (and
// also nothing for "skipped" if the section isn't locked, which shouldn't
// happen — locked is the only skip reason today). Locked sections always
// show a gray "Locked — kept" badge so the user sees, mid-run, which
// sections won't be touched.
function SectionStatusBadge({
  status,
  locked,
}: {
  status?: "writing" | "done" | "error" | "skipped";
  locked: boolean;
}) {
  if (locked || status === "skipped") {
    return (
      <span
        className="ds-pill ds-pill-neutral"
        title="Locked — kept as-is during Generate."
      >
        Locked — kept
      </span>
    );
  }
  if (status === "writing") {
    return (
      <span className="ds-pill ds-pill-neutral">
        <span
          aria-hidden
          className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-[color:var(--primary)]"
        />
        Writing…
      </span>
    );
  }
  if (status === "done") {
    return <span className="ds-pill ds-pill-success">✓ Done</span>;
  }
  if (status === "error") {
    return <span className="ds-pill ds-pill-danger">Generate failed</span>;
  }
  return null;
}

function exampleTextFor(section: OutlineSection): string {
  const heading = section.heading.trim();
  const hit = SECTION_EXAMPLES.find((e) => e.match.test(heading));
  if (hit) return hit.text;
  return (
    "On 2026-03-12 the checkout service was unavailable for 23 minutes after " +
    "a TLS certificate expired at 11:00. About 1,800 customers could not " +
    "complete a purchase before a renewed certificate restored service at " +
    "11:25. Replace this with the details that belong in your own document."
  );
}
