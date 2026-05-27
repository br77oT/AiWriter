"use client";

import { useEffect, useState } from "react";
import { useEnterExit } from "@/lib/use-enter-exit";

export type InfoModalKind = "about" | "contact";

// Match the CSS transition duration applied below so the fade-out finishes
// before the modal unmounts.
const MODAL_TRANSITION_MS = 150;

interface InfoModalProps {
  kind: InfoModalKind;
  onClose: () => void;
  // Lets each caller (footer, hamburger menu, etc.) keep its own stable
  // testid so component-scoped tests don't collide. Defaults preserve the
  // historical `footer-modal-<kind>` selector.
  testIdPrefix?: string;
}

// Shared About / Contact modal. Originally lived inside AppFooter; lifted out
// so the hamburger menu can open the same content without duplicating copy.
export function InfoModal({
  kind,
  onClose,
  testIdPrefix = "footer-modal-",
}: InfoModalProps) {
  // Self-managed open state so we can play the exit transition before
  // notifying the parent (which then unmounts us). `open` starts true — the
  // parent already decided to show us by rendering us.
  const [open, setOpen] = useState(true);
  const { mounted, entered } = useEnterExit(open, MODAL_TRANSITION_MS);

  // Once the exit animation is over (`mounted` flips false because `open`
  // is false), let the parent know it can drop us. Skipped on first render
  // because `open` is still true.
  useEffect(() => {
    if (!mounted && !open) onClose();
  }, [mounted, open, onClose]);

  if (!mounted) return null;

  const dismiss = () => setOpen(false);
  const title = kind === "about" ? "About AiWriter" : "Contact";
  return (
    <div
      role="dialog"
      aria-label={title}
      data-testid={`${testIdPrefix}${kind}`}
      className={
        "fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 transition-opacity duration-150 ease-out " +
        (entered ? "opacity-100" : "opacity-0")
      }
      onClick={dismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={
          "w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-4 text-sm shadow-lg transition-all duration-150 ease-out " +
          (entered ? "opacity-100 scale-100" : "opacity-0 scale-95")
        }
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={dismiss}
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
