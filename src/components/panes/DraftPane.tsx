"use client";

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
}: DraftPaneProps) {
  const sections = document.outline;
  const lockedIds = new Set(document.lockedSectionIds);
  const showGenerate = !readOnly && Boolean(onGenerate);

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

      {showGenerate && (
        <GenerateDraftButton
          position="top"
          generating={generating}
          canGenerate={canGenerate}
          onGenerate={onGenerate!}
        />
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
            return (
              <div key={section.id}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="text-sm font-medium text-neutral-800">
                    <span
                      data-testid={`section-prompt-number-${section.id}`}
                      className="mr-1 text-neutral-500"
                    >
                      {index + 1}.
                    </span>
                    {section.heading}
                    {!section.required && (
                      <span className="ml-1 text-xs text-neutral-400">
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
                          disabled={locked}
                          onClick={() =>
                            onDraftSectionChange(
                              section.id,
                              exampleTextFor(section)
                            )
                          }
                          className="rounded border border-neutral-300 bg-white px-2 py-0.5 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
                        >
                          Insert example
                        </button>
                      )}
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
                  )}
                </div>
                <textarea
                  aria-label={`Draft text for ${section.heading}`}
                  className="min-h-[6rem] w-full rounded border border-neutral-300 p-2 text-sm leading-relaxed disabled:bg-neutral-100 disabled:text-neutral-500"
                  value={document.draftSections[section.id] ?? ""}
                  disabled={locked || readOnly}
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
}: {
  position: "top" | "bottom";
  generating: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
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
      <button
        type="button"
        data-testid={`draft-generate-${position}`}
        onClick={onGenerate}
        disabled={generating || !canGenerate}
        title={
          canGenerate
            ? undefined
            : "Add at least one outline section to generate."
        }
        className="inline-flex items-center gap-1 rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100 disabled:bg-neutral-100 disabled:text-neutral-400"
      >
        <span>{generating ? "Generating…" : "Generate Draft"}</span>
        {/* Right arrow on both buttons — the click sends the prompts to
            the Assembled draft pane on the right. aria-hidden so screen
            readers hear only "Generate Draft". */}
        <span aria-hidden="true" className="text-neutral-500">
          →
        </span>
      </button>
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
