"use client";

import type { PromptExchange, PromptLog } from "@/lib/llm";

interface PromptInspectorPanelProps {
  // The most recent prompt log, or null if no LLM action has run this session.
  log: PromptLog | null;
  onClose: () => void;
}

// Modal-style overlay that shows the exact prompts the last LLM action sent
// to the server. The engines build their prompt strings privately; the API
// routes wrap the provider in a RecordingProvider and return the captured
// transcript, which is what this panel renders.
//
// One action (Generate, Validate, Auto-fix) can send several prompts — one
// per section / per check — so each exchange is an independently-collapsible
// block. The first is expanded by default.
export function PromptInspectorPanel({
  log,
  onClose,
}: PromptInspectorPanelProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-inspector-heading"
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <div>
            <h2
              id="prompt-inspector-heading"
              className="text-base font-semibold"
            >
              Prompt inspector
            </h2>
            {log && (
              <p className="text-xs text-neutral-500">
                {log.kind} · {log.exchanges.length} prompt
                {log.exchanges.length === 1 ? "" : "s"} ·{" "}
                {formatTimestamp(log.timestamp)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100"
          >
            Close
          </button>
        </div>

        {!log || log.exchanges.length === 0 ? (
          <div className="p-6 text-sm text-neutral-500">
            {log
              ? "This action did not send any prompts to the LLM."
              : "No prompts captured yet. Run Generate, Validate, Rewrite, " +
                "Expand, or Auto-fix and the exact prompt sent to the server " +
                "will appear here."}
          </div>
        ) : (
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {log.exchanges.map((exchange, i) => (
              <ExchangeBlock
                key={i}
                index={i}
                total={log.exchanges.length}
                exchange={exchange}
                defaultOpen={i === 0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ExchangeBlock({
  index,
  total,
  exchange,
  defaultOpen,
}: {
  index: number;
  total: number;
  exchange: PromptExchange;
  defaultOpen: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      data-testid="prompt-exchange"
      className="rounded border border-neutral-200"
    >
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
        Prompt {index + 1} of {total}
      </summary>
      <div className="space-y-3 border-t border-neutral-200 p-3">
        <PromptBlock label="System prompt" text={exchange.systemPrompt} />
        {exchange.messages.map((m, i) => (
          <PromptBlock
            key={i}
            label={`${m.role === "user" ? "User" : "Assistant"} message`}
            text={m.content}
          />
        ))}
        <PromptBlock label="Response" text={exchange.response} tone="response" />
      </div>
    </details>
  );
}

function PromptBlock({
  label,
  text,
  tone = "prompt",
}: {
  label: string;
  text: string;
  tone?: "prompt" | "response";
}) {
  const body =
    tone === "response"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-neutral-200 bg-neutral-50 text-neutral-800";
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </h3>
      <pre
        className={`max-h-72 overflow-auto whitespace-pre-wrap rounded border p-2 text-xs ${body}`}
      >
        {text === "" ? "(empty)" : text}
      </pre>
    </section>
  );
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
