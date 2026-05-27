"use client";

import type { ReactNode } from "react";
import type { Document } from "@/lib/types";
import { isDocumentEmpty } from "@/lib/templates";

interface WorkspaceGuideRowProps {
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

// Horizontal sibling of the bottom-left WorkspaceGuide. Each step has its
// own colour theme so the row reads as a workflow palette rather than five
// identical chips, plus an icon that hints at the action. Step definitions
// (labels, "done" rules, handlers) stay in sync with WorkspaceGuide.
export function WorkspaceGuideRow({
  document,
  generating,
  validating,
  canGenerate,
  onNewDocument,
  onSelectTemplate,
  onWriteDraft,
  onGenerate,
  onValidate,
}: WorkspaceGuideRowProps) {
  const hasDraft = Object.values(document.draftSections).some(
    (t) => t && t.trim() !== ""
  );

  interface Theme {
    soft: string; // bg + text classes used in the default/pending state
    solid: string; // bg + text classes used when the step is "done"
    border: string; // border colour, default state
    currentRing: string; // ring colour used on the "current" step
  }
  const themes: Record<string, Theme> = {
    indigo: {
      soft: "bg-indigo-50 text-indigo-700",
      solid: "bg-indigo-600 text-white",
      border: "border-indigo-200",
      currentRing: "ring-indigo-400",
    },
    violet: {
      soft: "bg-violet-50 text-violet-700",
      solid: "bg-violet-600 text-white",
      border: "border-violet-200",
      currentRing: "ring-violet-400",
    },
    amber: {
      soft: "bg-amber-50 text-amber-700",
      solid: "bg-amber-600 text-white",
      border: "border-amber-200",
      currentRing: "ring-amber-400",
    },
    blue: {
      soft: "bg-blue-50 text-blue-700",
      solid: "bg-blue-600 text-white",
      border: "border-blue-200",
      currentRing: "ring-blue-400",
    },
    emerald: {
      soft: "bg-emerald-50 text-emerald-700",
      solid: "bg-emerald-600 text-white",
      border: "border-emerald-200",
      currentRing: "ring-emerald-400",
    },
  };

  const steps: Array<{
    label: string;
    hint: string;
    ariaLabel: string;
    done: boolean;
    disabled: boolean;
    onClick: () => void;
    theme: Theme;
    icon: ReactNode;
  }> = [
    {
      label: "New document",
      hint: "Start a fresh draft from scratch",
      ariaLabel: "Guide: start a new document",
      done: true,
      disabled: false,
      onClick: onNewDocument,
      theme: themes.indigo,
      icon: <NewDocIcon />,
    },
    {
      label: "Pick template",
      hint: "Load an outline and checks to start from",
      ariaLabel: "Guide: pick a template",
      done: !isDocumentEmpty(document),
      disabled: false,
      onClick: onSelectTemplate,
      theme: themes.violet,
      icon: <TemplateIcon />,
    },
    {
      label: "Write draft",
      hint: "Fill in the text for each section",
      ariaLabel: "Guide: write the draft",
      done: hasDraft,
      disabled: document.outline.length === 0,
      onClick: onWriteDraft,
      theme: themes.amber,
      icon: <PencilIcon />,
    },
    {
      label: "Generate draft",
      hint: "Let AI write the first pass for you",
      ariaLabel: "Guide: generate the draft",
      // Mirror WorkspaceGuide: the milestone is "a draft exists", however the
      // text got there — so this completes alongside Write draft instead of
      // nagging a hand-writer to overwrite their work.
      done: hasDraft,
      disabled: !canGenerate || generating,
      onClick: onGenerate,
      theme: themes.blue,
      icon: <SparklesIcon />,
    },
    {
      label: "Validate",
      hint: "Check the draft against your checks",
      ariaLabel: "Guide: validate the draft",
      done: document.versions.some((v) => v.validationReport !== null),
      disabled: validating,
      onClick: onValidate,
      theme: themes.emerald,
      icon: <CheckCircleIcon />,
    },
  ];

  const currentIndex = steps.findIndex((s) => !s.done);

  return (
    <nav
      aria-label="Getting-started guide"
      data-testid="workspace-guide-row"
      className="flex flex-wrap items-center gap-2"
    >
      {steps.map((step, i) => {
        const isCurrent = i === currentIndex;
        const stateClasses = step.done
          ? `${step.theme.solid} border-transparent`
          : `${step.theme.soft} ${step.theme.border}`;
        const ringClasses = isCurrent
          ? `ring-2 ring-offset-1 ${step.theme.currentRing}`
          : "";
        return (
          <button
            key={step.label}
            type="button"
            onClick={step.onClick}
            disabled={step.disabled}
            aria-label={step.ariaLabel}
            aria-current={isCurrent ? "step" : undefined}
            title={step.hint}
            className={
              "inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 hover:brightness-95 " +
              stateClasses +
              (ringClasses ? " " + ringClasses : "")
            }
          >
            <span aria-hidden className="shrink-0">
              {step.icon}
            </span>
            <span>{step.label}</span>
            {step.done && (
              <span
                aria-hidden
                className="ml-0.5 text-[11px] leading-none"
                title="Done"
              >
                ✓
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

// --- Icons -----------------------------------------------------------------
// Pure SVG, no icon-library dependency. 14×14 to sit cleanly inside the chip.

function NewDocIcon() {
  return (
    <svg
      aria-hidden
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 3v5h5" />
      <path d="M19 12V8L14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7" />
      <line x1="16" y1="19" x2="22" y2="19" />
      <line x1="19" y1="16" x2="19" y2="22" />
    </svg>
  );
}

function TemplateIcon() {
  return (
    <svg
      aria-hidden
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="7" rx="1.5" />
      <rect x="3" y="14" width="9" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      aria-hidden
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg
      aria-hidden
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
      <path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14z" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg
      aria-hidden
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
