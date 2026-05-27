"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Document } from "@/lib/types";
import { isDocumentEmpty } from "@/lib/templates";
import { useEnterExit } from "@/lib/use-enter-exit";
import { InfoModal, type InfoModalKind } from "./InfoModal";

// Match the CSS transition duration on the dropdown panel below. Kept short
// (~150ms) so the menu still feels responsive on subsequent clicks.
const MENU_TRANSITION_MS = 150;

interface AppMenuProps {
  // Used by the Getting-started steps to compute done/disabled/current state.
  document: Document;
  // App-level button state, mirrored from TopBar so the menu can disable
  // items the user can't yet act on (matches the TopBar's existing rules).
  generating: boolean;
  validating: boolean;
  canGenerate: boolean;
  canExport: boolean;
  canSaveAsTemplate: boolean;
  versionCount: number;
  hasPromptLog: boolean;
  reviewerMode: boolean;
  // Getting-started step handlers.
  onNewDocument: () => void;
  onOpenTemplatePicker: () => void;
  onWriteDraft: () => void;
  // Shared with TopBar for the "App actions" section.
  onGenerate: () => void;
  onValidate: () => void;
  onOpenHistory: () => void;
  onOpenPrompts: () => void;
  onShareScenario: () => void;
  onOpenExport: () => void;
  onSaveAsTemplate: () => void;
  onToggleReviewerMode: (next: boolean) => void;
}

// Hamburger ("sandwich") menu that lives next to the app logo in the TopBar.
// Opens a dropdown panel containing two sections divided by an <hr>:
//   1. Getting started — the same five-step mini-map shown in WorkspaceGuide.
//   2. App actions — everything from the top bar (History, Prompts, Share,
//      Export, Save as template, Generate, Validate) plus New document,
//      Examples, Reviewer-mode toggle, and About.
//
// Closes on outside click, Escape, or after invoking an action (so the user
// immediately sees the result of what they picked).
export function AppMenu(props: AppMenuProps) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<InfoModalKind | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { mounted, entered } = useEnterExit(open, MENU_TRANSITION_MS);

  // Outside-click + Escape both close the dropdown. The About / Contact
  // modals own their own dismissal, so they stay open even after the
  // dropdown collapses.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      const node = rootRef.current;
      if (node && !node.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Invoking any action closes the menu so the user lands on the resulting
  // surface (modal, scrolled section, etc.) without the dropdown covering it.
  function runAndClose(fn: () => void) {
    return () => {
      fn();
      setOpen(false);
    };
  }

  const {
    document,
    generating,
    validating,
    canGenerate,
    canExport,
    canSaveAsTemplate,
    versionCount,
    hasPromptLog,
    reviewerMode,
  } = props;

  const hasDraft = Object.values(document.draftSections).some(
    (t) => t && t.trim() !== ""
  );

  // Mirrors the WorkspaceGuide step list. Same five stages, same labels —
  // anyone hitting either entry point sees identical wording.
  const steps: Array<{
    label: string;
    hint: string;
    done: boolean;
    disabled: boolean;
    onClick: () => void;
  }> = [
    {
      label: "New document",
      hint: "Start a fresh draft from scratch",
      done: true,
      disabled: false,
      onClick: props.onNewDocument,
    },
    {
      label: "Pick a template",
      hint: "Load an outline and checks to start from",
      done: !isDocumentEmpty(document),
      disabled: false,
      onClick: props.onOpenTemplatePicker,
    },
    {
      label: "Write the draft",
      hint: "Fill in the text for each section",
      done: hasDraft,
      disabled: document.outline.length === 0,
      onClick: props.onWriteDraft,
    },
    {
      label: "Generate draft",
      hint: "Let AI write the first pass for you",
      done: hasDraft,
      disabled: !canGenerate || generating,
      onClick: props.onGenerate,
    },
    {
      label: "Validate",
      hint: "Check the draft against your checks",
      done: document.versions.some((v) => v.validationReport !== null),
      disabled: validating,
      onClick: props.onValidate,
    },
  ];
  const currentIndex = steps.findIndex((s) => !s.done);

  // App-action items. Each has its own disabled rule that mirrors the
  // matching TopBar button so we don't surface a clickable affordance the
  // user can't actually use yet.
  const actions: Array<{
    label: string;
    hint?: string;
    disabled?: boolean;
    onClick: () => void;
  }> = [
    {
      label: `History${versionCount > 0 ? ` (${versionCount})` : ""}`,
      hint: "Browse prior Generate / Validate / Rewrite snapshots",
      disabled: versionCount === 0,
      onClick: props.onOpenHistory,
    },
    {
      label: "Prompts",
      hint: "Show the exact prompt sent to the LLM",
      disabled: !hasPromptLog,
      onClick: props.onOpenPrompts,
    },
  ];
  if (!reviewerMode) {
    actions.push(
      {
        label: "Share link",
        hint: "Create a link that recreates this document",
        onClick: props.onShareScenario,
      },
      {
        label: "Export",
        hint: "Download the generated draft",
        disabled: !canExport,
        onClick: props.onOpenExport,
      },
      {
        label: "Save as template…",
        hint: "Reuse this document's outline + checks",
        disabled: !canSaveAsTemplate,
        onClick: props.onSaveAsTemplate,
      },
      {
        label: generating ? "Generating…" : "Generate Draft",
        hint: "Let AI write a first pass for every section",
        disabled: generating || !canGenerate,
        onClick: props.onGenerate,
      },
      {
        label: validating ? "Validating…" : "Validate",
        hint: "Grade the draft against your checks",
        disabled: validating,
        onClick: props.onValidate,
      }
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Open app menu"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="app-menu-button"
        onClick={() => setOpen((p) => !p)}
        className="flex h-7 w-7 items-center justify-center rounded border border-neutral-300 bg-white hover:bg-neutral-100"
      >
        <HamburgerIcon />
      </button>

      {mounted && (
        <div
          role="menu"
          aria-label="App menu"
          data-testid="app-menu-panel"
          className={
            "absolute left-0 top-full z-30 mt-2 w-72 origin-top-left rounded-lg border border-neutral-300 bg-white shadow-lg transition-all duration-150 ease-out " +
            (entered
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 -translate-y-1 scale-95 pointer-events-none")
          }
        >
          {/* Getting-started is an author-oriented mini-map. Reviewer mode
              omits it for the same reason WorkspaceGuide hides itself there —
              reviewers aren't authoring a document through these stages. */}
          {!reviewerMode && (
            <>
          <section>
            <h2 className="border-b border-neutral-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-600">
              Getting started
            </h2>
            <ol className="p-2">
              {steps.map((step, i) => {
                const isCurrent = i === currentIndex;
                return (
                  <li key={step.label}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={runAndClose(step.onClick)}
                      disabled={step.disabled}
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
                        <span className="text-xs text-neutral-500">
                          {step.hint}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>

          <hr
            data-testid="app-menu-divider"
            className="border-t border-neutral-200"
          />
            </>
          )}

          <section>
            <h2 className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-600">
              App actions
            </h2>
            <ul className="px-2 pb-2">
              <li>
                <Link
                  href="/scenarios"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="block rounded px-2 py-1.5 text-left text-sm text-blue-600 hover:bg-neutral-50 hover:underline"
                >
                  Examples
                </Link>
              </li>
              {actions.map((a) => (
                <li key={a.label}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={runAndClose(a.onClick)}
                    disabled={a.disabled}
                    className="flex w-full flex-col items-start gap-0.5 rounded px-2 py-1.5 text-left hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="text-sm font-medium text-neutral-800">
                      {a.label}
                    </span>
                    {a.hint && (
                      <span className="text-xs text-neutral-500">{a.hint}</span>
                    )}
                  </button>
                </li>
              ))}
              <li>
                <label className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">
                  <input
                    type="checkbox"
                    aria-label="Reviewer mode"
                    checked={reviewerMode}
                    onChange={(e) => {
                      props.onToggleReviewerMode(e.target.checked);
                      setOpen(false);
                    }}
                  />
                  Reviewer mode
                </label>
              </li>
              <li>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setInfo("about");
                    setOpen(false);
                  }}
                  className="block w-full rounded px-2 py-1.5 text-left text-sm text-neutral-800 hover:bg-neutral-50"
                >
                  About
                </button>
              </li>
            </ul>
          </section>
        </div>
      )}

      {info && (
        <InfoModal
          kind={info}
          onClose={() => setInfo(null)}
          testIdPrefix="app-menu-modal-"
        />
      )}
    </div>
  );
}

function HamburgerIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <line x1="3" y1="4.5" x2="13" y2="4.5" />
      <line x1="3" y1="8" x2="13" y2="8" />
      <line x1="3" y1="11.5" x2="13" y2="11.5" />
    </svg>
  );
}
