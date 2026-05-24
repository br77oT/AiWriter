"use client";

import { useEffect, useState } from "react";

const HIDDEN_KEY = "aiwriter:footerHidden";

type ModalKind = "about" | "contact" | null;

// Persistent app footer. Lives in the root layout so it renders on every
// page. The × button hides it for good (per browser via localStorage);
// there's no UI to bring it back yet because About / Contact aren't critical
// enough to warrant the chrome.
export function AppFooter() {
  // Default to hidden during SSR + initial paint so we never show the footer,
  // then hide it on hydration once the user has dismissed it. The opposite
  // default would briefly flash the footer for users who hid it.
  const [hidden, setHidden] = useState(true);
  const [modal, setModal] = useState<ModalKind>(null);

  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(HIDDEN_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  function hide() {
    setHidden(true);
    try {
      window.localStorage.setItem(HIDDEN_KEY, "1");
    } catch {
      /* private mode / disabled storage — degrade silently */
    }
  }

  if (hidden) return null;

  return (
    <>
      <footer
        data-testid="app-footer"
        className="flex items-center justify-between border-t border-neutral-200 bg-white px-4 py-1.5 text-xs text-neutral-600"
      >
        <span className="text-neutral-400">© AiWriter</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setModal("about")}
            className="rounded hover:underline"
          >
            About
          </button>
          <button
            type="button"
            onClick={() => setModal("contact")}
            className="rounded hover:underline"
          >
            Contact
          </button>
          <button
            type="button"
            aria-label="Hide footer"
            title="Hide this footer"
            onClick={hide}
            className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 leading-none text-neutral-500 hover:bg-neutral-100"
          >
            ×
          </button>
        </div>
      </footer>
      {modal && <InfoModal kind={modal} onClose={() => setModal(null)} />}
    </>
  );
}

function InfoModal({
  kind,
  onClose,
}: {
  kind: Exclude<ModalKind, null>;
  onClose: () => void;
}) {
  const title = kind === "about" ? "About AiWriter" : "Contact";
  return (
    <div
      role="dialog"
      aria-label={title}
      data-testid={`footer-modal-${kind}`}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-4 text-sm shadow-lg"
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs hover:bg-neutral-100"
          >
            Close
          </button>
        </div>
        {kind === "about" ? (
          <p className="text-neutral-700">
            AiWriter turns a spec, outline, and a list of checks into a
            structured draft, then grades the draft against those checks.
            Generation can run against the Anthropic API or a local
            ClaudeInBrowserSocket server.
          </p>
        ) : (
          <p className="text-neutral-700">
            Email{" "}
            <a
              className="text-blue-600 underline hover:text-blue-800"
              href="mailto:hello@aiwriter.example"
            >
              hello@aiwriter.example
            </a>
            . Replace this placeholder with a real address before shipping.
          </p>
        )}
      </div>
    </div>
  );
}
