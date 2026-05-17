import type { LlmKeyStatus } from "@/lib/llm";

interface LlmKeyWarningProps {
  // Only the non-"ok" states render a banner; callers gate on that.
  status: Exclude<LlmKeyStatus, "ok">;
}

// Amber banner shown when ANTHROPIC_API_KEY is missing or unusable. Pure and
// presentational, so it renders in both server components (the scenarios
// gallery) and the client workspace.
export function LlmKeyWarning({ status }: LlmKeyWarningProps) {
  return (
    <div
      role="status"
      data-testid="llm-key-warning"
      data-key-status={status}
      className="border-b border-amber-300 bg-amber-50 px-4 py-1.5 text-xs text-amber-800"
    >
      {status === "missing" ? (
        <>
          <span className="font-semibold">No API key configured.</span>{" "}
          <code>ANTHROPIC_API_KEY</code> isn&apos;t set — draft generation and
          document-check evaluation run against a stub and won&apos;t produce
          real results.
        </>
      ) : (
        <>
          <span className="font-semibold">
            The configured API key won&apos;t work.
          </span>{" "}
          <code>ANTHROPIC_API_KEY</code> is an OAuth / Claude-subscription
          token (<code>sk-ant-oat…</code>), not an API key — document-check
          evaluation will fail. Replace it with an{" "}
          <code>sk-ant-api03-…</code> key.
        </>
      )}
    </div>
  );
}
