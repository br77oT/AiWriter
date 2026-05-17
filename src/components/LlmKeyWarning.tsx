// Amber banner shown when ANTHROPIC_API_KEY is not configured — generation
// and document-check evaluation fall back to the echo stub. Pure and
// presentational, so it renders in both server components (the scenarios
// gallery) and the client workspace.
export function LlmKeyWarning() {
  return (
    <div
      role="status"
      data-testid="llm-stub-banner"
      className="border-b border-amber-300 bg-amber-50 px-4 py-1.5 text-xs text-amber-800"
    >
      <span className="font-semibold">No API key configured.</span>{" "}
      <code>ANTHROPIC_API_KEY</code> isn&apos;t set — draft generation and
      document-check evaluation run against a stub and won&apos;t produce real
      results.
    </div>
  );
}
