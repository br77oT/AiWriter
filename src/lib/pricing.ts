// Per-model API pricing for cost estimation. Numbers are USD per 1,000,000
// tokens, taken from Anthropic's public pricing for the listed models.
// Update these alongside model bumps.
//
// Local-mode runs don't actually incur any cost; the Statistics pane uses
// `FALLBACK_MODEL` to estimate "what this would cost on the API" so the
// user can compare. If a model name isn't in the table, `estimateCost`
// returns null (rendered as "—" in the UI rather than a fake $0.00).

export interface ModelPrice {
  // USD per 1,000,000 input tokens.
  inputPerMillion: number;
  // USD per 1,000,000 output tokens.
  outputPerMillion: number;
}

// Source: anthropic.com/pricing as of early 2026. Conservative — update
// when models / pricing change.
export const PRICES: Record<string, ModelPrice> = {
  "claude-opus-4-5": { inputPerMillion: 15, outputPerMillion: 75 },
  "claude-opus-4-7": { inputPerMillion: 15, outputPerMillion: 75 },
  "claude-sonnet-4-5": { inputPerMillion: 3, outputPerMillion: 15 },
  "claude-sonnet-4-6": { inputPerMillion: 3, outputPerMillion: 15 },
  "claude-haiku-4-5-20251001": { inputPerMillion: 1, outputPerMillion: 5 },
};

// The model AiWriter uses by default for Anthropic-backed generation, and
// the one we use to price local-mode runs in the "would have cost" column.
export const FALLBACK_MODEL = "claude-sonnet-4-5";

export interface UsageLike {
  inputTokens: number;
  outputTokens: number;
}

// Returns the USD cost of a single `{input, output}` usage tuple at the
// given model's price, or null if the model isn't in the table.
export function estimateCost(
  usage: UsageLike,
  model: string
): number | null {
  const price = PRICES[model];
  if (!price) return null;
  return (
    (usage.inputTokens * price.inputPerMillion) / 1_000_000 +
    (usage.outputTokens * price.outputPerMillion) / 1_000_000
  );
}

// Convenience: format a USD amount as "$0.0042" for tiny figures, "$1.23"
// otherwise, "—" for null. Keeps significant digits even for sub-cent costs.
export function formatUsd(amount: number | null): string {
  if (amount === null) return "—";
  if (amount === 0) return "$0.00";
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}
