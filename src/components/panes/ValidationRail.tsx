"use client";

import type { Document, ValidationReport } from "@/lib/types";

export type AutofixMode = "questions" | "structure";

interface ValidationRailProps {
  document: Document;
  report: ValidationReport | null;
  status: "idle" | "running" | "error";
  autofixBusy?: boolean;
  lockedSkipped?: string[];
  onAutofix?: (mode: AutofixMode) => void;
  // When true, the rail fills its parent rather than imposing a fixed
  // width. Used by the mobile layout where the active-tab area owns the
  // width.
  compact?: boolean;
}

const STRUCTURE_BADGE: Record<string, { glyph: string; tone: string }> = {
  present: { glyph: "✓", tone: "text-emerald-700" },
  thin: { glyph: "~", tone: "text-amber-700" },
  missing: { glyph: "✗", tone: "text-red-700" },
};

const QUESTION_BADGE: Record<string, { label: string; tone: string }> = {
  answered: { label: "Answered", tone: "text-emerald-700" },
  partial: { label: "Partial", tone: "text-amber-700" },
  missing: { label: "Missing", tone: "text-red-700" },
  // Not a content verdict — the check never ran. Neutral tone keeps it from
  // reading as a red "your draft failed" result.
  error: { label: "Not evaluated", tone: "text-neutral-500" },
};

export function ValidationRail({
  document,
  report,
  status,
  autofixBusy = false,
  lockedSkipped,
  onAutofix,
  compact = false,
}: ValidationRailProps) {
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
        "flex h-full flex-col overflow-y-auto bg-white p-3 text-sm " +
        (compact
          ? "w-full"
          : "w-80 shrink-0 border-l border-neutral-200")
      }
      aria-labelledby="validation-rail-heading"
    >
      <div className="mb-3 flex items-baseline justify-between">
        <h2
          id="validation-rail-heading"
          className="text-sm font-semibold uppercase tracking-wide text-neutral-600"
        >
          Validation
        </h2>
        {report && <CoverageBadge score={report.coverageScore} />}
      </div>

      {status === "running" && (
        <p className="text-neutral-500" data-testid="validation-status">
          Running validation…
        </p>
      )}
      {status === "error" && (
        <p className="text-red-700" data-testid="validation-status">
          Validation failed. Try again.
        </p>
      )}

      {!report && status === "idle" && (
        <p className="text-neutral-400">
          Click <span className="font-medium">Validate</span> to run a check.
        </p>
      )}

      {report && (
        <>
          <section className="mb-4">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Structure
            </h3>
            {report.structure.length === 0 ? (
              <p className="text-neutral-400">No outline sections defined.</p>
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
                        <div className="text-neutral-800">
                          {headingFor(s.outlineId)}
                        </div>
                        {s.note && (
                          <div className="text-xs text-neutral-500">
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
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Document Checks
            </h3>
            {erroredChecks > 0 && (
              <p
                className="mb-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800"
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
              <p className="text-neutral-400">No checks defined.</p>
            ) : (
              <ul className="space-y-3">
                {report.questions.map((q) => {
                  const badge = QUESTION_BADGE[q.status];
                  return (
                    <li key={q.checkId} className="border-l-2 border-neutral-200 pl-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-neutral-800">
                          {questionFor(q.checkId)}
                        </span>
                        <span className={`text-xs font-medium ${badge.tone}`}>
                          {badge.label}
                        </span>
                      </div>
                      {q.evidence && (
                        <div className="mt-1 text-xs text-neutral-600">
                          <span className="font-semibold">Evidence: </span>
                          <span className="italic">“{q.evidence}”</span>
                        </div>
                      )}
                      {q.suggestion && (
                        <div className="mt-1 text-xs text-neutral-600">
                          <span className="font-semibold">Suggestion: </span>
                          {q.suggestion}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {lockedSkipped && lockedSkipped.length > 0 && (
            <p
              className="mt-4 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800"
              data-testid="autofix-locked-notice"
            >
              Skipped {lockedSkipped.length} locked section
              {lockedSkipped.length === 1 ? "" : "s"} that contained failing
              items: {lockedSkipped.map(headingFor).join(", ")}. Unlock to
              regenerate.
            </p>
          )}

          {onAutofix && (
            <div className="mt-4 flex flex-col gap-2 border-t border-neutral-200 pt-3">
              <button
                type="button"
                disabled={autofixBusy || failingChecks === 0}
                onClick={() => onAutofix("questions")}
                className="rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
              >
                Auto-fix missing items
              </button>
              <button
                type="button"
                disabled={autofixBusy || failingStructure === 0}
                onClick={() => onAutofix("structure")}
                className="rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
              >
                Regenerate only failed sections
              </button>
              {autofixBusy && (
                <p className="text-xs text-neutral-500" data-testid="autofix-status">
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
      className="rounded bg-neutral-900 px-2 py-0.5 font-mono text-xs text-white"
      data-testid="coverage-score"
      title="Checks answered / Sections present"
    >
      {score.checksAnswered}/{score.checksTotal} checks ·{" "}
      {score.sectionsPresent}/{score.sectionsTotal} sections
    </span>
  );
}
