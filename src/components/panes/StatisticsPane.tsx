"use client";

import type { Document, Version } from "@/lib/types";
import { CollapseButton, CollapsedStrip } from "./CollapsiblePane";
import {
  estimateCost,
  FALLBACK_MODEL,
  formatUsd,
} from "@/lib/pricing";

interface StatisticsPaneProps {
  document: Document;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

// At-a-glance Statistics for the current document: how long things took,
// how many times it was regenerated, the current draft word count, and an
// API-cost estimate. Reads exclusively from the persisted Document — every
// number except the live word count comes off `document.versions[].metrics`,
// so the figures stay correct across reloads.
export function StatisticsPane({
  document,
  collapsed = false,
  onToggleCollapse,
}: StatisticsPaneProps) {
  if (collapsed && onToggleCollapse) {
    return <CollapsedStrip label="Stats" onExpand={onToggleCollapse} />;
  }
  const stats = summarize(document);
  return (
    <section
      data-testid="statistics-pane"
      className="flex h-full flex-col gap-3 overflow-y-auto border-r border-neutral-200 bg-white p-3"
      aria-labelledby="statistics-pane-heading"
    >
      <div className="flex items-center gap-2">
        <h2
          id="statistics-pane-heading"
          className="text-sm font-semibold uppercase tracking-wide text-neutral-600"
        >
          Statistics
        </h2>
        {onToggleCollapse && (
          <CollapseButton label="Statistics" onCollapse={onToggleCollapse} />
        )}
      </div>
      <p
        data-testid="statistics-pane-description"
        className="-mt-1 text-xs text-neutral-500"
      >
        At-a-glance metrics: how long each step took, how many times the
        draft was regenerated, the current word count, and an API-cost
        estimate.
      </p>

      <Group title="Draft">
        <Row label="Total words" value={String(stats.draft.totalWords)} />
        <Row
          label="Generations"
          value={String(stats.draft.generations)}
          hint="Number of full-draft Generate runs"
        />
        <Row
          label="Total Generate time"
          value={formatDurationMs(stats.draft.totalGenerateMs)}
        />
        <Row
          label="Last Generate"
          value={formatDurationMs(stats.draft.lastGenerateMs)}
        />
      </Group>

      <Group title="Validation">
        <Row label="Runs" value={String(stats.validate.runs)} />
        <Row
          label="Total time"
          value={formatDurationMs(stats.validate.totalMs)}
        />
        <Row label="Last run" value={formatDurationMs(stats.validate.lastMs)} />
      </Group>

      <Group title="Cost">
        <Row
          label="Actual API spend"
          value={formatUsd(stats.cost.actualUsd)}
          hint="Sum of Anthropic-provider runs at the model's current rates"
        />
        <Row
          label="If local ran on API"
          value={formatUsd(stats.cost.wouldBeUsd)}
          hint={`Local-mode runs priced as if they had used ${FALLBACK_MODEL}`}
        />
        <Row
          label="Tokens (in / out)"
          value={
            stats.cost.totalInputTokens === 0 &&
            stats.cost.totalOutputTokens === 0
              ? "—"
              : `${formatTokens(stats.cost.totalInputTokens)} / ${formatTokens(
                  stats.cost.totalOutputTokens
                )}`
          }
        />
      </Group>

      {document.outline.length > 0 && (
        <Group title="Per-section words">
          {document.outline.map((s) => {
            const text = (document.draftSections[s.id] ?? "").trim();
            return (
              <Row
                key={s.id}
                label={s.heading}
                value={String(countWords(text))}
              />
            );
          })}
        </Group>
      )}
    </section>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  // Visually styled like a section header, but not an <h3> — the workspace
  // tests look up panes by heading role, and Statistics labels its groups
  // with the same names ("Draft", "Validation"). Using a div avoids the
  // collision without renaming user-facing copy.
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </div>
      <dl className="space-y-1 text-sm">{children}</dl>
    </div>
  );
}

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-neutral-700" title={hint}>
        {label}
      </dt>
      <dd className="font-mono text-neutral-900">{value}</dd>
    </div>
  );
}

// --- Summary computation -------------------------------------------------

interface DraftStats {
  totalWords: number;
  generations: number;
  totalGenerateMs: number;
  lastGenerateMs: number | null;
}

interface ValidateStats {
  runs: number;
  totalMs: number;
  lastMs: number | null;
}

interface CostStats {
  actualUsd: number | null; // null only if NO Anthropic runs have ever happened
  wouldBeUsd: number | null;
  totalInputTokens: number;
  totalOutputTokens: number;
}

interface Stats {
  draft: DraftStats;
  validate: ValidateStats;
  cost: CostStats;
}

export function summarize(document: Document): Stats {
  const draft: DraftStats = {
    totalWords: Object.values(document.draftSections).reduce(
      (n, txt) => n + countWords(txt),
      0
    ),
    generations: 0,
    totalGenerateMs: 0,
    lastGenerateMs: null,
  };
  const validate: ValidateStats = {
    runs: 0,
    totalMs: 0,
    lastMs: null,
  };

  let actualUsd = 0;
  let actualUsdHasValue = false;
  let wouldBeUsd = 0;
  let wouldBeUsdHasValue = false;
  let totalInput = 0;
  let totalOutput = 0;

  for (const v of document.versions) {
    const isGenerate = v.label === "Generate";
    const isValidate = v.label === "Validate";
    const ms = v.metrics?.durationMs ?? 0;
    if (isGenerate) {
      draft.generations += 1;
      draft.totalGenerateMs += ms;
      draft.lastGenerateMs = ms || draft.lastGenerateMs;
    }
    if (isValidate) {
      validate.runs += 1;
      validate.totalMs += ms;
      validate.lastMs = ms || validate.lastMs;
    }
    // Cost: count every metered event regardless of label.
    if (v.metrics?.tokenUsage) {
      totalInput += v.metrics.tokenUsage.inputTokens;
      totalOutput += v.metrics.tokenUsage.outputTokens;
      if (v.metrics.provider === "anthropic" && v.metrics.model) {
        const cost = estimateCost(v.metrics.tokenUsage, v.metrics.model);
        if (cost !== null) {
          actualUsd += cost;
          actualUsdHasValue = true;
          wouldBeUsd += cost;
          wouldBeUsdHasValue = true;
        }
      } else if (v.metrics.provider === "local") {
        // Local: real cost is $0; would-be cost prices the same tokens at
        // the fallback (Sonnet) rates so the user can compare.
        actualUsdHasValue = true;
        const wouldHave = estimateCost(v.metrics.tokenUsage, FALLBACK_MODEL);
        if (wouldHave !== null) {
          wouldBeUsd += wouldHave;
          wouldBeUsdHasValue = true;
        }
      }
    } else if (v.metrics?.provider === "local") {
      // Local runs commonly have no token counts — still mark cost as
      // "tracked" (real cost is $0) so the row shows "$0.00" rather than "—".
      actualUsdHasValue = true;
    }
  }

  return {
    draft,
    validate,
    cost: {
      actualUsd: actualUsdHasValue ? actualUsd : null,
      wouldBeUsd: wouldBeUsdHasValue ? wouldBeUsd : null,
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
    },
  };
}

// --- Helpers --------------------------------------------------------------

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  return trimmed.split(/\s+/).length;
}

export function formatDurationMs(ms: number | null): string {
  if (ms === null || ms === 0) return "—";
  if (ms < 1000) return `${ms} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds - minutes * 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

// Re-export the Version type used by tests so they don't need to import
// from @/lib/types just for assertion construction.
export type { Version };
