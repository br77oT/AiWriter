"use client";

import { useState } from "react";

interface ScenarioShareModalProps {
  url: string | null;
  busy: boolean;
  onClose: () => void;
}

// Shows the shareable scenario link after it has been minted. `url` is null
// while the POST is in flight (busy) — the modal renders a loading line then.
export function ScenarioShareModal({
  url,
  busy,
  onClose,
}: ScenarioShareModalProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard blocked (insecure context / permissions) — the user can
      // still select the text in the field manually.
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-label="Shareable scenario link"
    >
      <div className="w-[30rem] max-w-full rounded-lg bg-white p-4 shadow-xl">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-600">
          Shareable link
        </h2>
        <p className="mb-3 text-xs text-neutral-600">
          Opening this link creates a fresh copy of this document — spec,
          outline, checks and draft — then generates and validates the draft
          automatically.
        </p>

        {busy && (
          <p className="text-sm text-neutral-500" data-testid="scenario-busy">
            Creating link…
          </p>
        )}

        {!busy && !url && (
          <p className="text-sm text-red-700">
            Couldn&apos;t create the link. Close this and try again.
          </p>
        )}

        {!busy && url && (
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={url}
              aria-label="Scenario link"
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={copy}
              className="rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
