"use client";

import { useEffect, useState } from "react";
import { InfoModal, type InfoModalKind } from "./InfoModal";

const HIDDEN_KEY = "aiwriter:footerHidden";

type ModalKind = InfoModalKind | null;

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
