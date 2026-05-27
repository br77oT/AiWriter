"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Template } from "@/lib/templates";
import type { Document } from "@/lib/types";
import { AppMenu } from "./AppMenu";
import { WorkspaceGuideRow } from "./WorkspaceGuideRow";

interface TopBarProps {
  // The full document drives the hamburger menu's "Getting started" step
  // state (done / current / disabled). TopBar itself only uses the title.
  document: Document;
  documentTitle: string;
  validating: boolean;
  generating: boolean;
  canGenerate: boolean;
  canExport: boolean;
  templates: Template[];
  selectedTemplateId: string | null;
  canSaveAsTemplate: boolean;
  versionCount: number;
  // Whether an LLM action has run this session, so the Prompts button has a
  // transcript to show.
  hasPromptLog: boolean;
  reviewerMode: boolean;
  onValidate: () => void;
  onGenerate: () => void;
  onLoadFixture: (fixtureId: string) => void;
  onSelectTemplate: (templateId: string) => void;
  onSaveAsTemplate: () => void;
  onOpenHistory: () => void;
  onOpenPrompts: () => void;
  onOpenExport: () => void;
  onShareScenario: () => void;
  onToggleReviewerMode: (next: boolean) => void;
  // Hamburger-menu-only handlers. The TopBar itself doesn't render these as
  // buttons — they exist in the dropdown as a one-stop menu of app actions.
  onNewDocument: () => void;
  onOpenTemplatePicker: () => void;
  onWriteDraft: () => void;
  // Document-level actions. Omitted in reviewer mode (the buttons hide).
  onRenameDocument?: (nextTitle: string) => void;
  onDeleteDocument?: () => void;
  // Group-visibility toggles. "Doc options" shows Spec/Outline/Checks;
  // "Validations" shows the Validation rail + Statistics. Both default to
  // hidden in Workspace so the layout opens focused on Draft.
  docOptionsVisible: boolean;
  validationsVisible: boolean;
  onToggleDocOptions: () => void;
  onToggleValidations: () => void;
  // Tagline link handlers. Each opens the matching pane and triggers a
  // 👉 hint near it. The TopBar renders the tagline as clickable spans.
  onOpenSpec: () => void;
  onOpenOutline: () => void;
  onOpenStructured: () => void;
  // "Simplified view": hide both Doc-options and Validations groups in one
  // click. Disabled when both are already hidden.
  onSimplifiedView: () => void;
}

// Top bar shell. In reviewer mode (slice 014), mutating actions are hidden:
// Generate / Validate / Export / Save / Save-as-template / Template selector /
// Load fixture. The History button stays visible (reviewers can browse) and
// the Reviewer-mode toggle stays visible so an author can flip back. Per
// PRD user story 39 + issue 014.
export function TopBar({
  document,
  documentTitle,
  validating,
  generating,
  canGenerate,
  canExport,
  templates,
  selectedTemplateId,
  canSaveAsTemplate,
  versionCount,
  hasPromptLog,
  reviewerMode,
  onValidate,
  onGenerate,
  onLoadFixture,
  onSelectTemplate,
  onSaveAsTemplate,
  onOpenHistory,
  onOpenPrompts,
  onOpenExport,
  onShareScenario,
  onToggleReviewerMode,
  onNewDocument,
  onOpenTemplatePicker,
  onWriteDraft,
  onRenameDocument,
  onDeleteDocument,
  docOptionsVisible,
  validationsVisible,
  onToggleDocOptions,
  onToggleValidations,
  onOpenSpec,
  onOpenOutline,
  onOpenStructured,
  onSimplifiedView,
}: TopBarProps) {
  return (
    <header className="flex flex-col gap-1 border-b border-neutral-200 bg-white px-4 py-2">
      {/* Row 1 — brand on the left, all action buttons on the right. */}
      <div
        data-testid="top-bar-actions"
        className="flex flex-wrap items-center gap-3"
      >
        <div className="flex items-center gap-2" data-testid="app-brand">
          <AppMenu
            document={document}
            generating={generating}
            validating={validating}
            canGenerate={canGenerate}
            canExport={canExport}
            canSaveAsTemplate={canSaveAsTemplate}
            versionCount={versionCount}
            hasPromptLog={hasPromptLog}
            reviewerMode={reviewerMode}
            onNewDocument={onNewDocument}
            onOpenTemplatePicker={onOpenTemplatePicker}
            onWriteDraft={onWriteDraft}
            onGenerate={onGenerate}
            onValidate={onValidate}
            onOpenHistory={onOpenHistory}
            onOpenPrompts={onOpenPrompts}
            onShareScenario={onShareScenario}
            onOpenExport={onOpenExport}
            onSaveAsTemplate={onSaveAsTemplate}
            onToggleReviewerMode={onToggleReviewerMode}
          />
          <AppLogo />
          <span className="font-semibold tracking-tight">AiWriter</span>
          <span
            data-testid="app-tagline"
            className="hidden text-xs text-[color:var(--text-secondary)] sm:inline"
          >
            Turn a{" "}
            <TaglineLink testid="tagline-spec" onClick={onOpenSpec}>
              spec
            </TaglineLink>
            ,{" "}
            <TaglineLink testid="tagline-outline" onClick={onOpenOutline}>
              outline
            </TaglineLink>
            , and checks into a{" "}
            <TaglineLink testid="tagline-structured" onClick={onOpenStructured}>
              generated draft
            </TaglineLink>
            .
          </span>
        </div>
        <Link
          href="/scenarios"
          className="text-sm font-medium text-blue-600 underline hover:text-blue-800"
        >
          Examples
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenHistory}
            disabled={versionCount === 0}
            title={
              versionCount === 0
                ? "Run Generate, Validate, Rewrite, or Auto-fix to record a version."
                : undefined
            }
            className="rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100 disabled:bg-neutral-100 disabled:text-neutral-400"
          >
            History{versionCount > 0 ? ` (${versionCount})` : ""}
          </button>
          <button
            type="button"
            onClick={onOpenPrompts}
            disabled={!hasPromptLog}
            title={
              hasPromptLog
                ? "Show the exact prompt sent to the LLM by the last action."
                : "Run Generate, Validate, Rewrite, or Auto-fix to capture a prompt."
            }
            className="rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100 disabled:bg-neutral-100 disabled:text-neutral-400"
          >
            Prompts
          </button>
          {!reviewerMode && (
            <button
              type="button"
              aria-label="Share link"
              onClick={onShareScenario}
              title="Share link — creates a URL that recreates this document and auto-runs Generate + Validate."
              className="ds-btn-secondary px-2"
            >
              <ShareIcon />
            </button>
          )}
          {!reviewerMode && (
            <button
              type="button"
              aria-label="Export"
              onClick={onOpenExport}
              disabled={!canExport}
              title={
                canExport
                  ? "Export — download the structured draft."
                  : "Add at least one section of draft text before exporting."
              }
              className="ds-btn-secondary px-2"
            >
              <ExportIcon />
            </button>
          )}
        </div>
      </div>

      {/* Row 2 — document-scoped: title + Delete on the left; mutating
          actions (Load fixture, Save as template, Save, Generate Draft,
          Validate) and the Reviewer-mode toggle on the right. */}
      <div
        data-testid="top-bar-doc-controls"
        className="flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-1"
      >
        <DocumentTitle
          title={documentTitle}
          editable={!reviewerMode && Boolean(onRenameDocument)}
          onRename={onRenameDocument}
        />
        {!reviewerMode && onDeleteDocument && (
          <button
            type="button"
            aria-label="Delete document"
            title="Delete this document. This cannot be undone."
            onClick={() => {
              const ok = window.confirm(
                `Delete "${documentTitle}"? This cannot be undone.`
              );
              if (ok) onDeleteDocument();
            }}
            className="rounded-[var(--radius-control)] border border-[color:var(--danger-bg)] bg-white px-2 py-0.5 text-xs font-medium text-[color:var(--danger-fg)] hover:bg-[color:var(--danger-bg)]"
          >
            Delete
          </button>
        )}
        <ViewToggle
          label="Doc options"
          on={docOptionsVisible}
          onClick={onToggleDocOptions}
          title="Show Tone & purpose, Document outline, and Validation checks panes."
          testid="toggle-doc-options"
        />
        <ViewToggle
          label="Validations"
          on={validationsVisible}
          onClick={onToggleValidations}
          title="Show the Validation rail and Statistics panel."
          testid="toggle-validations"
        />
        <button
          type="button"
          data-testid="simplified-view"
          onClick={onSimplifiedView}
          disabled={!docOptionsVisible && !validationsVisible}
          title="Hide Doc options and Validations for a focused Draft + Structured view."
          className="rounded-[var(--radius-control)] border border-[color:var(--border-subtle)] bg-white px-2.5 py-1 text-xs font-medium text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-sunken)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Simplified view
        </button>
        {reviewerMode && (
          <span data-testid="reviewer-mode-badge" className="ds-pill ds-pill-warning">
            Reviewer mode
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!reviewerMode && <Divider />}
          {!reviewerMode && (
            <button
              type="button"
              className="rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100"
            >
              Save
            </button>
          )}
          {!reviewerMode && (
            <button
              type="button"
              onClick={onGenerate}
              disabled={generating || !canGenerate}
              title={
                canGenerate
                  ? undefined
                  : "Add at least one outline section, and give every required section a heading, before generating."
              }
              className="ds-btn-primary"
            >
              {generating ? "Generating…" : "Generate Draft"}
            </button>
          )}
          {!reviewerMode && (
            <button
              type="button"
              onClick={onValidate}
              disabled={validating}
              className="ds-btn-soft"
            >
              {validating ? "Validating…" : "Validate"}
            </button>
          )}
          <Divider />
          <label className="flex items-center gap-1 text-sm text-neutral-700">
            <input
              type="checkbox"
              aria-label="Reviewer mode"
              checked={reviewerMode}
              onChange={(e) => onToggleReviewerMode(e.target.checked)}
            />
            Reviewer mode
          </label>
        </div>
      </div>

      {/* Row 3 — horizontal guide. The same five stages as the bottom-left
          WorkspaceGuide mini-map, surfaced inline so the user can jump
          between stages without opening the mini-map. Hidden in reviewer
          mode (reviewers don't author through these stages). */}
      {!reviewerMode && (
        <div className="flex items-center border-t border-neutral-100 pt-1.5">
          <WorkspaceGuideRow
            document={document}
            generating={generating}
            validating={validating}
            canGenerate={canGenerate}
            onNewDocument={onNewDocument}
            onSelectTemplate={onOpenTemplatePicker}
            onWriteDraft={onWriteDraft}
            onGenerate={onGenerate}
            onValidate={onValidate}
          />
        </div>
      )}
    </header>
  );
}

// Clickable word inside the brand tagline that opens the matching pane.
// Styled as a blue underline link so it's obvious the words are interactive.
function TaglineLink({
  children,
  onClick,
  testid,
}: {
  children: React.ReactNode;
  onClick: () => void;
  testid: string;
}) {
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={onClick}
      className="font-medium text-[color:var(--primary)] underline-offset-2 hover:underline"
    >
      {children}
    </button>
  );
}

// Compact on/off button for show-hide-group toggles. The leading eye /
// eye-slash icon makes the current visibility readable at a glance; the
// solid vs. outlined fill reinforces it for users who can't see the icon
// clearly (small UI, low contrast, etc.).
function ViewToggle({
  label,
  on,
  onClick,
  title,
  testid,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  title: string;
  testid: string;
}) {
  return (
    <button
      type="button"
      data-testid={testid}
      aria-pressed={on}
      onClick={onClick}
      title={title}
      className={
        "inline-flex items-center gap-1 rounded-[var(--radius-control)] border px-2.5 py-1 text-xs font-medium transition-colors " +
        (on
          ? "border-transparent bg-[color:var(--primary-soft)] text-[color:var(--primary)] hover:bg-[#c7dcfd]"
          : "border-[color:var(--border-subtle)] bg-white text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-sunken)]")
      }
    >
      <EyeIcon hidden={!on} />
      {label}
    </button>
  );
}

// Share icon — three dots connected by lines (web "share" glyph). Sized to
// match the surrounding sm text so it sits cleanly inside the secondary
// button frame.
function ShareIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
      <line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
    </svg>
  );
}

// Export / download icon — tray with a down-arrow falling into it. Used on
// the Export button.
function ExportIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

// Eye / eye-slash icon. Pure SVG, sized to match the surrounding xs text.
// `hidden=true` adds a diagonal slash through the eye to signal "off".
function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {hidden && <line x1="4" y1="20" x2="20" y2="4" />}
    </svg>
  );
}

// Thin vertical separator between groups of controls. aria-hidden because
// it carries no semantics — it just visually groups neighbouring buttons.
function Divider() {
  return (
    <span
      aria-hidden="true"
      data-testid="top-bar-divider"
      className="select-none text-neutral-300"
    >
      |
    </span>
  );
}

// Inline brand mark — a notched square with a quill-style diagonal stroke.
// Pure SVG, no asset file. aria-hidden because the "AiWriter" wordmark next
// to it already carries the brand name for screen readers.
function AppLogo() {
  return (
    <svg
      data-testid="app-logo"
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 22 22"
      className="shrink-0"
    >
      <rect x="1" y="1" width="20" height="20" rx="5" fill="#171717" />
      {/* Stylized "A" + a small underline accent suggesting a pen stroke. */}
      <path
        d="M6.5 16 L11 5 L15.5 16 M8.4 12.5 L13.6 12.5"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <line
        x1="6"
        y1="18.2"
        x2="16"
        y2="18.2"
        stroke="#fbbf24"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Inline-editable title. Clicking the title (when editable) flips it into a
// text input. Enter or blur commits; Escape cancels. Blank titles fall back
// to "Untitled document" so the sidebar always has something to render.
function DocumentTitle({
  title,
  editable,
  onRename,
}: {
  title: string;
  editable: boolean;
  onRename?: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Stay in sync if the doc gets renamed elsewhere while we're not editing.
  useEffect(() => {
    if (!editing) setDraft(title);
  }, [title, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const next = draft.trim() || "Untitled document";
    setEditing(false);
    setDraft(next);
    if (next !== title) onRename?.(next);
  };
  const cancel = () => {
    setDraft(title);
    setEditing(false);
  };

  if (!editable) {
    return (
      <span className="text-sm text-neutral-700" data-testid="doc-title">
        {title}
      </span>
    );
  }
  if (!editing) {
    return (
      <button
        type="button"
        data-testid="doc-title"
        title="Click to rename"
        onClick={() => setEditing(true)}
        className="rounded text-sm text-neutral-700 hover:bg-neutral-100 px-1 -mx-1"
      >
        {title}
      </button>
    );
  }
  return (
    <input
      ref={inputRef}
      data-testid="doc-title-input"
      aria-label="Rename document"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancel();
        }
      }}
      className="rounded border border-neutral-300 bg-white px-1 py-0.5 text-sm text-neutral-800"
    />
  );
}
