"use client";

import { useEffect, useState } from "react";

const HIDDEN_KEY = "aiwriter:footerHidden";

type ModalKind = "about" | "contact" | null;

// Persistent app footer. Lives in the root layout so it renders on every
// page.
//
// Single row: copyright on the left, About / Contact / × on the right.
// The × hides the whole footer and persists the preference to localStorage.
export function AppFooter() {
  // Default to hidden during SSR + initial paint so we never flash the bar
  // for users who already dismissed it; the effect below corrects it on
  // the client.
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
        className="flex items-center justify-between gap-3 border-t border-neutral-200 bg-white px-4 py-1.5 text-xs text-neutral-600"
      >
        <span data-testid="app-copyright" className="text-neutral-400">
          © 2026 AiWriter
          <sup className="ml-0.5 text-[0.6rem] font-medium">℠</sup>
        </span>
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
          <div className="space-y-2 text-neutral-700">
            <p>
              AiWriter helps you draft structured documents (postmortems,
              proposals, briefs, design docs) with AI without losing control
              of the output.
            </p>
            <p>It addresses a few problems with one-shot AI drafting:</p>
            <ul className="list-disc space-y-1.5 pl-5 text-xs">
              <li>
                <span className="font-semibold">Drafts drift from what you
                need.</span>{" "}
                You define the spec, outline, and checks up front; the model
                writes one section at a time against that scaffold instead of
                inventing a shape.
              </li>
              <li>
                <span className="font-semibold">You can&apos;t tell if the
                result is any good.</span>{" "}
                Validation grades every section structurally and runs each
                check against the prose, so missing, thin, or unanswered
                content is visible at a glance.
              </li>
              <li>
                <span className="font-semibold">Re-prompting throws away good
                work.</span>{" "}
                Lock sections you like; Rewrite or Expand the ones you
                don&apos;t. Locked text is bit-identical across regenerations.
              </li>
              <li>
                <span className="font-semibold">AI workflows are
                black-boxes.</span>{" "}
                The Prompt Inspector shows the exact prompts that hit the
                model; version history snapshots every Generate, Validate,
                Rewrite, and Auto-fix.
              </li>
            </ul>
            <p>
              Generation runs against the Anthropic API by default, or against
              a local ClaudeInBrowserSocket server when you set{" "}
              <code>LLM_PROVIDER=local</code>.
            </p>
          </div>
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
