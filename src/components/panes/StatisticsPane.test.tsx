import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import {
  StatisticsPane,
  countWords,
  formatDurationMs,
  summarize,
} from "./StatisticsPane";
import { newDocument, type Document, type Version } from "@/lib/types";

afterEach(() => cleanup());

function makeDoc(overrides: Partial<Document> = {}): Document {
  return {
    ...newDocument("doc-1", "2026-04-30T00:00:00.000Z"),
    outline: [
      { id: "summary", heading: "Summary", description: "", required: true },
      { id: "impact", heading: "Impact", description: "", required: true },
    ],
    draftSections: {
      summary: "Two words.",
      impact: "Three more words here.",
    },
    ...overrides,
  };
}

function v(
  id: string,
  label: string,
  ts: string,
  metrics?: Version["metrics"]
): Version {
  return {
    id,
    label,
    timestamp: ts,
    draftSections: {},
    validationReport: null,
    ...(metrics ? { metrics } : {}),
  };
}

describe("StatisticsPane — helpers", () => {
  it("counts words by whitespace splits", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
    expect(countWords("one")).toBe(1);
    expect(countWords("two words")).toBe(2);
    expect(countWords("  many\nshapes\tof\twhitespace ")).toBe(4);
  });

  it("formats durations as ms / seconds / minutes+seconds", () => {
    expect(formatDurationMs(null)).toBe("—");
    expect(formatDurationMs(0)).toBe("—");
    expect(formatDurationMs(150)).toBe("150 ms");
    expect(formatDurationMs(2500)).toBe("2.5 s");
    expect(formatDurationMs(75_000)).toBe("1m 15s");
  });
});

describe("StatisticsPane — summarize()", () => {
  it("aggregates draft + validate + cost stats from the document's versions", () => {
    const doc: Document = makeDoc({
      versions: [
        v("g1", "Generate", "2026-05-01T00:00:00.000Z", {
          durationMs: 4000,
          provider: "anthropic",
          model: "claude-sonnet-4-5",
          tokenUsage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
        }),
        v("v1", "Validate", "2026-05-01T00:01:00.000Z", {
          durationMs: 2000,
          provider: "anthropic",
          model: "claude-sonnet-4-5",
          tokenUsage: { inputTokens: 500_000, outputTokens: 100_000 },
        }),
        v("g2", "Generate", "2026-05-02T00:00:00.000Z", {
          durationMs: 6000,
          provider: "local",
          tokenUsage: undefined,
        }),
      ],
    });
    const s = summarize(doc);

    // Draft section sums the two seeded draft sections (2 + 4 = 6 words).
    expect(s.draft.totalWords).toBe(6);
    expect(s.draft.generations).toBe(2);
    expect(s.draft.totalGenerateMs).toBe(10_000);
    // Validate counts only the "Validate"-labelled entry.
    expect(s.validate.runs).toBe(1);
    expect(s.validate.totalMs).toBe(2000);

    // Cost: Sonnet at 1M/1M = $18. Plus Validate's smaller usage:
    // 500k*$3 + 100k*$15 per million = $1.50 + $1.50 = $3. Total $21.
    expect(s.cost.actualUsd).toBeCloseTo(21, 6);
    // Would-be: same as actual since local-mode g2 had no usage.
    expect(s.cost.wouldBeUsd).toBeCloseTo(21, 6);
    expect(s.cost.totalInputTokens).toBe(1_500_000);
    expect(s.cost.totalOutputTokens).toBe(1_100_000);
  });

  it("local-mode runs with usage add to would-be cost but NOT to actual", () => {
    const doc: Document = makeDoc({
      versions: [
        v("g", "Generate", "2026-05-01T00:00:00.000Z", {
          durationMs: 1000,
          provider: "local",
          tokenUsage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
        }),
      ],
    });
    const s = summarize(doc);
    // Local runs incur no real bill — actual stays $0 (with the local marker).
    expect(s.cost.actualUsd).toBe(0);
    // Would-be priced at Sonnet rates = $18.
    expect(s.cost.wouldBeUsd).toBeCloseTo(18, 6);
  });

  it("returns null cost values when no version was ever metered", () => {
    const doc: Document = makeDoc({
      versions: [v("legacy", "Generate", "2026-05-01T00:00:00.000Z")],
    });
    const s = summarize(doc);
    expect(s.cost.actualUsd).toBeNull();
    expect(s.cost.wouldBeUsd).toBeNull();
  });
});

describe("StatisticsPane — rendering", () => {
  it("renders the description + group headings + key rows", () => {
    render(<StatisticsPane document={makeDoc()} />);
    expect(screen.getByTestId("statistics-pane")).toBeInTheDocument();
    expect(screen.getByTestId("statistics-pane-description")).toHaveTextContent(
      /at-a-glance metrics/i
    );
    expect(screen.getByText(/^Draft$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Validation$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Cost$/i)).toBeInTheDocument();
    expect(screen.getByText(/Total words/i)).toBeInTheDocument();
    expect(screen.getByText(/Generations/i)).toBeInTheDocument();
    expect(screen.getByText(/Actual API spend/i)).toBeInTheDocument();
  });

  it("renders the per-section words list", () => {
    render(<StatisticsPane document={makeDoc()} />);
    // Per-section row labels come from the outline headings.
    expect(screen.getByText("Summary")).toBeInTheDocument();
    expect(screen.getByText("Impact")).toBeInTheDocument();
  });

  it("collapses to a thin strip when collapsed + onToggleCollapse provided", () => {
    const onToggle = vi.fn();
    render(
      <StatisticsPane document={makeDoc()} collapsed onToggleCollapse={onToggle} />
    );
    expect(screen.queryByTestId("statistics-pane")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /expand stats/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
