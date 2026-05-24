import type { LlmKeyStatus } from "@/lib/llm";

interface LlmKeyWarningProps {
  // The "ok" status renders nothing; callers gate on that and never pass it.
  status: Exclude<LlmKeyStatus, { kind: "ok" }>;
}

// Status banner shown above the workspace and scenarios pages.
//   - Amber for warnings (missing key, unusable key).
//   - Slate for the informational "local mode" notice — local is a real
//     provider, not a fallback, so a yellow warning would be misleading.
export function LlmKeyWarning({ status }: LlmKeyWarningProps) {
  if (status.kind === "local") {
    return (
      <div
        role="status"
        data-testid="llm-key-warning"
        data-key-status="local"
        className="border-b border-slate-300 bg-slate-50 px-4 py-1.5 text-xs text-slate-700"
      >
        <span className="font-semibold">Local mode.</span> Talking to{" "}
        <code>{status.localUrl}</code> (ClaudeInBrowserSocket). Make sure the
        server is running, or generation will fail.
      </div>
    );
  }
  return (
    <div
      role="status"
      data-testid="llm-key-warning"
      data-key-status={status.kind}
      className="border-b border-amber-300 bg-amber-50 px-4 py-1.5 text-xs text-amber-800"
    >
      {status.kind === "missing" ? (
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
