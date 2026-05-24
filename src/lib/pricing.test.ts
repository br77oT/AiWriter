import { describe, it, expect } from "vitest";
import { estimateCost, formatUsd, FALLBACK_MODEL } from "./pricing";

describe("estimateCost", () => {
  it("returns null for unknown models", () => {
    expect(estimateCost({ inputTokens: 1000, outputTokens: 100 }, "unknown"))
      .toBeNull();
  });

  it("computes input + output cost for a known model (Sonnet)", () => {
    // Sonnet: $3/M in, $15/M out. 1M input + 1M output = $18.
    expect(estimateCost({ inputTokens: 1_000_000, outputTokens: 1_000_000 }, FALLBACK_MODEL))
      .toBeCloseTo(18, 6);
  });

  it("scales linearly for small token counts", () => {
    // 1000 input @ $3/M = $0.003; 200 output @ $15/M = $0.003 → total $0.006
    const cost = estimateCost(
      { inputTokens: 1000, outputTokens: 200 },
      FALLBACK_MODEL
    );
    expect(cost).toBeCloseTo(0.006, 6);
  });

  it("Opus and Haiku tiers are priced differently", () => {
    const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000 };
    const opus = estimateCost(usage, "claude-opus-4-7");
    const sonnet = estimateCost(usage, "claude-sonnet-4-6");
    const haiku = estimateCost(usage, "claude-haiku-4-5-20251001");
    expect(opus!).toBeGreaterThan(sonnet!);
    expect(sonnet!).toBeGreaterThan(haiku!);
  });
});

describe("formatUsd", () => {
  it("returns — for null", () => {
    expect(formatUsd(null)).toBe("—");
  });
  it("returns $0.00 for exactly zero", () => {
    expect(formatUsd(0)).toBe("$0.00");
  });
  it("shows four decimals under a cent so sub-cent figures aren't lost", () => {
    expect(formatUsd(0.0042)).toBe("$0.0042");
  });
  it("shows two decimals for $0.01 and above", () => {
    expect(formatUsd(0.01)).toBe("$0.01");
    expect(formatUsd(1.234)).toBe("$1.23");
  });
});
