"use client";

import { useState } from "react";
import type { Template } from "@/lib/templates";

interface OnboardingWizardProps {
  templates: Template[];
  busy: boolean;
  onComplete: (templateId: string) => void;
}

// Three-step first-run wizard per PRD user story 37 and
// `prd/make ux wireframes.md` "First-run flow":
//   1. Choose a document type
//   2. Review preloaded Outline + Checks (skipped for Custom)
//   3. Land in workspace (handled by the host page on onComplete)
//
// "Custom" is the only built-in that ships an empty bundle, so step 2 has
// nothing to preview — we skip straight to step 3 (per AC: "Step 1 'Custom'
// selection skips step 2 and creates a blank document").
//
// User-saved templates are intentionally not surfaced here; onboarding is the
// four V1 document types only. Built-in vs. user-saved is the filter.
export function OnboardingWizard({
  templates,
  busy,
  onComplete,
}: OnboardingWizardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const builtIns = templates.filter((t) => t.builtIn);
  const selected = selectedId
    ? builtIns.find((t) => t.id === selectedId) ?? null
    : null;

  function handlePick(template: Template) {
    // Custom skips the preview step — there is nothing to preview when the
    // bundle has no outline or checks. Empty-bundle is the structural signal,
    // not the slug, so future blank built-ins also skip cleanly.
    const empty =
      template.bundle.outline.length === 0 &&
      template.bundle.checks.length === 0;
    if (empty) {
      onComplete(template.id);
      return;
    }
    setSelectedId(template.id);
  }

  return (
    <main
      className="flex h-full items-center justify-center bg-neutral-50 p-6"
      aria-label="First-run onboarding"
    >
      <div className="flex w-full max-w-2xl flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        {selected ? (
          <PreviewStep
            template={selected}
            busy={busy}
            onBack={() => setSelectedId(null)}
            onConfirm={() => onComplete(selected.id)}
          />
        ) : (
          <PickStep
            templates={builtIns}
            busy={busy}
            onPick={handlePick}
          />
        )}
      </div>
    </main>
  );
}

interface PickStepProps {
  templates: Template[];
  busy: boolean;
  onPick: (template: Template) => void;
}

function PickStep({ templates, busy, onPick }: PickStepProps) {
  return (
    <>
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Step 1 of 3
        </p>
        <h1 className="text-xl font-semibold tracking-tight">
          Choose a document type
        </h1>
        <p className="text-sm text-neutral-600">
          Pick a starter so your Spec, Outline, and Checks are ready to edit.
        </p>
      </header>
      <ul className="grid gap-2">
        {templates.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onPick(t)}
              className="flex w-full flex-col items-start gap-1 rounded-md border border-neutral-200 bg-white p-3 text-left hover:bg-neutral-50 disabled:cursor-not-allowed disabled:bg-neutral-100"
            >
              <span className="text-sm font-medium">{t.name}</span>
              <span className="text-xs text-neutral-500">
                {describeTemplate(t)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

interface PreviewStepProps {
  template: Template;
  busy: boolean;
  onBack: () => void;
  onConfirm: () => void;
}

function PreviewStep({ template, busy, onBack, onConfirm }: PreviewStepProps) {
  return (
    <>
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Step 2 of 3
        </p>
        <h1 className="text-xl font-semibold tracking-tight">
          Review preloaded {template.name}
        </h1>
        <p className="text-sm text-neutral-600">
          These will be loaded into your new document. You can edit them after.
        </p>
      </header>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Outline</h2>
        <ul className="flex flex-col gap-1">
          {template.bundle.outline.map((s) => (
            <li
              key={s.id}
              className="flex flex-col rounded border border-neutral-200 bg-neutral-50 px-3 py-2"
            >
              <span className="text-sm font-medium">{s.heading}</span>
              {s.description && (
                <span className="text-xs text-neutral-600">
                  {s.description}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Checks</h2>
        <ul className="flex flex-col gap-1">
          {template.bundle.checks.map((c) => (
            <li
              key={c.id}
              className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm"
            >
              {c.question}
            </li>
          ))}
        </ul>
      </section>
      <div className="flex items-center justify-between gap-2 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-100"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          aria-label="Use this template"
          className="rounded bg-neutral-900 px-3 py-1 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
        >
          {busy ? "Creating…" : "Use this template"}
        </button>
      </div>
    </>
  );
}

function describeTemplate(t: Template): string {
  const oCount = t.bundle.outline.length;
  const cCount = t.bundle.checks.length;
  if (oCount === 0 && cCount === 0) {
    return "Start with a blank Spec, Outline, and Checks.";
  }
  return `${oCount} sections · ${cCount} checks`;
}
