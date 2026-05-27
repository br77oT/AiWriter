"use client";

import type { Document, ValidationReport } from "@/lib/types";
import { CollapseButton, CollapsedStrip } from "./CollapsiblePane";

export type AutofixMode = "questions" | "structure";

interface ValidationRailProps {
  document: Document;
  report: ValidationReport | null;
  status: "idle" | "running" | "error";
  // Live per-check progress while a validate run is streaming. `null` when
  // no validate is in flight, or when the run hasn't reached its first
  // check yet (structural eval is instant; no progress event for it).
  progress?: {
    index: number; // 0-based
    total: number;
    question: string;
  } | null;
  autofixBusy?: boolean;
  lockedSkipped?: string[];
  onAutofix?: (mode: AutofixMode) => void;
  // When true, the rail fills its parent rather than imposing a fixed
  // width. Used by the mobile layout where the active-tab area owns the
  // width.
  compact?: boolean;
  // Collapse seam — same pattern as the four left-hand panes. When
  // `collapsed` is true and `onToggleCollapse` is provided, the rail
  // renders as a thin vertical strip with an Expand button.
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const STRUCTURE_BADGE: Record<string, { glyph: string; tone: string }> = {
  present: { glyph: "✓", tone: "text-[color:var(--success-fg)]" },
  thin: { glyph: "~", tone: "text-[color:var(--warning-fg)]" },
  missing: { glyph: "✗", tone: "text-[color:var(--danger-fg)]" },
};

const QUESTION_BADGE: Record<string, { label: string; pillClass: string }> = {
  answered: { label: "Answered", pillClass: "ds-pill ds-pill-success" },
  partial: { label: "Partial", pillClass: "ds-pill ds-pill-warning" },
  missing: { label: "Missing", pillClass: "ds-pill ds-pill-danger" },
  // Not a content verdict — the check never ran. Neutral tone keeps it from
  // reading as a red "your draft failed" result.
  error: { label: "Not evaluated", pillClass: "ds-pill ds-pill-neutral" },
};

export function ValidationRail({
  document,
  report,
  status,
  progress = null,
  autofixBusy = false,
  lockedSkipped,
  onAutofix,
  compact = false,
  collapsed = false,
  onToggleCollapse,
}: ValidationRailProps) {
  if (collapsed && onToggleCollapse) {
    // CollapsedStrip has no intrinsic width — wrap it so the rail still
    // claims a thin slot in the workspace layout when not in compact (mobile)
    // mode. Left border keeps the separation from the Draft pane that the
    // expanded rail already has via its outer aside.
    return (
      <div
        className={
          compact
            ? "w-full"
            : "w-10 shrink-0 border-l border-neutral-200"
        }
      >
        <CollapsedStrip label="Validation" onExpand={onToggleCollapse} />
      </div>
    );
  }
  const headingFor = (outlineId: string) =>
    document.outline.find((s) => s.id === outlineId)?.heading ?? outlineId;
  const questionFor = (checkId: string) =>
    document.checks.find((c) => c.id === checkId)?.question ?? checkId;

  const failingChecks = report
    ? report.questions.filter(
        (q) => q.status === "missing" || q.status === "partial"
      ).length
    : 0;
  const failingStructure = report
    ? report.structure.filter(
        (s) => s.status === "missing" || s.status === "thin"
      ).length
    : 0;
  // Checks the evaluator could not run at all — surfaced separately from
  // genuine "missing" results so the user isn't told their draft is at fault.
  const erroredChecks = report
    ? report.questions.filter((q) => q.status === "error").length
    : 0;

  return (
    <aside
      className={
        "flex h-full flex-col overflow-y-auto bg-white p-4 text-sm " +
        (compact
          ? "w-full"
          : "w-80 shrink-0 border-l border-[color:var(--border-subtle)]")
      }
      aria-labelledby="validation-rail-heading"
    >
      <div className="flex items-center gap-2">
        <h2 id="validation-rail-heading" className="ds-pane-heading">
          Validation
        </h2>
        {onToggleCollapse && (
          <CollapseButton label="Validation" onCollapse={onToggleCollapse} />
        )}
      </div>
      <p
        data-testid="validation-rail-description"
        className="mb-3 mt-0.5 text-xs text-[color:var(--text-tertiary)]"
      >
        How well the current draft meets the spec — each section&apos;s
        structural status plus answers to your checks.
      </p>
      {report && (
        <div className="mb-3">
          <CoverageBadge score={report.coverageScore} />
        </div>
      )}

      {status === "running" && (
        <div
          data-testid="validation-status"
          className="ds-list-item space-y-1"
        >
          <p className="flex items-center gap-2 text-[color:var(--text-secondary)]">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[color:var(--border-subtle)] border-t-[color:var(--primary)]"
            />
            {progress
              ? `Evaluating check ${progress.index + 1} of ${progress.total}`
              : `Evaluating ${document.checks.length} check${
                  document.checks.length === 1 ? "" : "s"
                } (one LLM call each)…`}
          </p>
          {progress && (
            <p
              data-testid="validation-progress-question"
              className="truncate pl-5 text-xs italic text-[color:var(--text-tertiary)]"
              title={progress.question}
            >
              “{progress.question}”
            </p>
          )}
        </div>
      )}
      {status === "error" && (
        <p
          className="text-[color:var(--danger-fg)]"
          data-testid="validation-status"
        >
          Validation failed. Try again.
        </p>
      )}

      {!report && status === "idle" && (
        <p className="text-[color:var(--text-tertiary)]">
          Click <span className="font-medium">Validate</span> to run a check.
        </p>
      )}

      {report && (
        <>
          <section className="mb-4">
            <h3 className="ds-pane-heading mb-1">Structure</h3>
            {report.structure.length === 0 ? (
              <p className="text-[color:var(--text-tertiary)]">
                No outline sections defined.
              </p>
            ) : (
              <ul className="space-y-1">
                {report.structure.map((s) => {
                  const badge = STRUCTURE_BADGE[s.status];
                  return (
                    <li key={s.outlineId} className="flex items-baseline gap-2">
                      <span
                        className={`w-4 font-mono ${badge.tone}`}
                        aria-label={s.status}
                      >
                        {badge.glyph}
                      </span>
                      <div className="flex-1">
                        <div className="text-[color:var(--text-primary)]">
                          {headingFor(s.outlineId)}
                        </div>
                        {s.note && (
                          <div className="text-xs text-[color:var(--text-tertiary)]">
                            {s.note}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <h3 className="ds-pane-heading mb-1">Document Checks</h3>
            {erroredChecks > 0 && (
              <p
                className="mb-2 rounded-[var(--radius-control)] border border-[color:var(--warning-bg)] bg-[color:var(--warning-bg)]/40 p-2 text-xs text-[color:var(--warning-fg)]"
                data-testid="evaluator-error-notice"
              >
                {erroredChecks === report.questions.length
                  ? "None of the checks could be evaluated"
                  : `${erroredChecks} of ${report.questions.length} checks couldn't be evaluated`}
                . The check evaluator (an AI model) didn&apos;t return a usable
                response — most often because <code>ANTHROPIC_API_KEY</code> is
                not configured for the app. These checks were{" "}
                <span className="font-semibold">not assessed</span>; they
                aren&apos;t necessarily missing from your draft. Re-run Validate
                once the evaluator is available.
              </p>
            )}
            {report.questions.length === 0 ? (
              <p className="text-[color:var(--text-tertiary)]">
                No checks defined.
              </p>
            ) : (
              <ol className="space-y-3">
                {report.questions.map((q, idx) => {
                  const badge = QUESTION_BADGE[q.status];
                  return (
                    <li
                      key={q.checkId}
                      className="border-l-2 border-[color:var(--border-subtle)] pl-2"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 flex-1 text-[color:var(--text-primary)]">
                          <span
                            data-testid={`question-number-${q.checkId}`}
                            className="mr-1 select-none text-xs text-[color:var(--text-tertiary)]"
                          >
                            {idx + 1}.
                          </span>
                          {questionFor(q.checkId)}
                        </span>
                        <span className={badge.pillClass}>{badge.label}</span>
                      </div>
                      {q.evidence && (
                        <div className="mt-1 text-xs text-[color:var(--text-secondary)]">
                          <span className="font-semibold">Evidence: </span>
                          <span className="italic">“{q.evidence}”</span>
                        </div>
                      )}
                      {q.suggestion && (
                        <div className="mt-1 text-xs text-[color:var(--text-secondary)]">
                          <span className="font-semibold">Suggestion: </span>
                          {q.suggestion}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {lockedSkipped && lockedSkipped.length > 0 && (
            <p
              className="mt-4 rounded-[var(--radius-control)] border border-[color:var(--warning-bg)] bg-[color:var(--warning-bg)]/40 p-2 text-xs text-[color:var(--warning-fg)]"
              data-testid="autofix-locked-notice"
            >
              Skipped {lockedSkipped.length} locked section
              {lockedSkipped.length === 1 ? "" : "s"} that contained failing
              items: {lockedSkipped.map(headingFor).join(", ")}. Unlock to
              regenerate.
            </p>
          )}

          {onAutofix && (
            <div className="mt-4 flex flex-col gap-2 border-t border-[color:var(--border-subtle)] pt-3">
              <button
                type="button"
                disabled={autofixBusy || failingChecks === 0}
                onClick={() => onAutofix("questions")}
                className="ds-btn-soft"
              >
                Auto-fix missing items
              </button>
              <button
                type="button"
                disabled={autofixBusy || failingStructure === 0}
                onClick={() => onAutofix("structure")}
                className="ds-btn-soft"
              >
                Regenerate only failed sections
              </button>
              {autofixBusy && (
                <p
                  className="text-xs text-[color:var(--text-tertiary)]"
                  data-testid="autofix-status"
                >
                  Regenerating…
                </p>
              )}
            </div>
          )}
        </>
      )}
    </aside>
  );
}

function CoverageBadge({
  score,
}: {
  score: ValidationReport["coverageScore"];
}) {
  return (
    <span
      className="inline-flex items-center rounded-full bg-[color:var(--primary)] px-3 py-1 font-mono text-xs text-white"
      data-testid="coverage-score"
      title="Checks answered / Sections present"
    >
      {score.checksAnswered}/{score.checksTotal} checks ·{" "}
      {score.sectionsPresent}/{score.sectionsTotal} sections
    </span>
  );
}
