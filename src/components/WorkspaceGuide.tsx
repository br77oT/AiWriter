"use client";

import { useEffect, useState } from "react";
import type { Document } from "@/lib/types";
import { isDocumentEmpty } from "@/lib/templates";

interface WorkspaceGuideProps {
  document: Document;
  generating: boolean;
  validating: boolean;
  canGenerate: boolean;
  onNewDocument: () => void;
  onSelectTemplate: () => void;
  onWriteDraft: () => void;
  onGenerate: () => void;
  onValidate: () => void;
}

// localStorage key for the collapsed/expanded preference. Expanded by default
// — the guide exists to orient first-time users; anyone who knows the flow
// dismisses it once and it stays dismissed.
const COLLAPSED_KEY = "aiwriter:guideCollapsed";

// A small fixed "mini-map" in the bottom-left corner. It lays out the five
// stages of producing a document and lets the user jump straight to any of
// them. The stage the document is currently up to is highlighted, so a new
// user always sees an obvious next move.
export function WorkspaceGuide({
  document,
  generating,
  validating,
  canGenerate,
  onNewDocument,
  onSelectTemplate,
  onWriteDraft,
  onGenerate,
  onValidate,
}: WorkspaceGuideProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Read the saved preference after mount (localStorage is client-only) so
  // the server render and first client render agree.
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      // Storage unavailable — leave the guide expanded.
    }
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // Best-effort; the in-memory toggle still works.
      }
      return next;
    });
  }

  const hasDraft = Object.values(document.draftSections).some(
    (t) => t && t.trim() !== ""
  );
  const steps: Array<{
    label: string;
    hint: string;
    ariaLabel: string;
    done: boolean;
    disabled: boolean;
    onClick: () => void;
  }> = [
    {
      label: "New document",
      hint: "Start a fresh draft from scratch",
      ariaLabel: "Guide: start a new document",
      done: true,
      disabled: false,
      onClick: onNewDocument,
    },
    {
      label: "Pick a template",
      hint: "Load an outline and checks to start from",
      ariaLabel: "Guide: pick a template",
      done: !isDocumentEmpty(document),
      disabled: false,
      onClick: onSelectTemplate,
    },
    {
      label: "Write the draft",
      hint: "Fill in the text for each section",
      ariaLabel: "Guide: write the draft",
      done: hasDraft,
      disabled: document.outline.length === 0,
      onClick: onWriteDraft,
    },
    {
      label: "Generate draft",
      hint: "Let AI write the first pass for you",
      ariaLabel: "Guide: generate the draft",
      // An optional accelerator for "Write the draft": its milestone — a draft
      // exists — is met however the text got there, so it completes alongside
      // the draft step rather than nagging a hand-writer to overwrite it.
      done: hasDraft,
      disabled: !canGenerate || generating,
      onClick: onGenerate,
    },
    {
      label: "Validate",
      hint: "Check the draft against your checks",
      ariaLabel: "Guide: validate the draft",
      done: document.versions.some((v) => v.validationReport !== null),
      disabled: validating,
      onClick: onValidate,
    },
  ];

  // The current stage is the first one not yet done; once everything is done
  // there is no current stage (-1).
  const currentIndex = steps.findIndex((s) => !s.done);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label="Open the getting-started guide"
        className="fixed bottom-3 left-3 z-20 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-md hover:bg-neutral-100"
      >
        ▸ Getting started
      </button>
    );
  }

  return (
    <aside
      aria-label="Getting-started guide"
      className="fixed bottom-3 left-3 z-20 w-60 rounded-lg border border-neutral-300 bg-white shadow-lg"
    >
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Getting started
        </h2>
        <button
          type="button"
          onClick={toggle}
          aria-label="Hide the getting-started guide"
          className="rounded px-1.5 leading-none text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        >
          —
        </button>
      </div>
      <ol className="p-2">
        {steps.map((step, i) => {
          const isCurrent = i === currentIndex;
          return (
            <li key={step.label}>
              <button
                type="button"
                onClick={step.onClick}
                disabled={step.disabled}
                aria-label={step.ariaLabel}
                aria-current={isCurrent ? "step" : undefined}
                className={
                  "flex w-full items-start gap-2 rounded px-2 py-1.5 text-left disabled:cursor-not-allowed disabled:opacity-50 " +
                  (isCurrent
                    ? "bg-blue-50 ring-1 ring-blue-200"
                    : "hover:bg-neutral-50")
                }
              >
                <span
                  aria-hidden
                  className={
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold " +
                    (step.done
                      ? "bg-green-600 text-white"
                      : isCurrent
                        ? "bg-blue-600 text-white"
                        : "border border-neutral-300 text-neutral-500")
                  }
                >
                  {step.done ? "✓" : i + 1}
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-neutral-800">
                    {step.label}
                  </span>
                  <span className="text-xs text-neutral-500">{step.hint}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
