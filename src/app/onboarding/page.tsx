"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import {
  BUILT_IN_TEMPLATES,
  applyTemplate,
  type Template,
} from "@/lib/templates";
import type { Document } from "@/lib/types";

// First-run + "New document" entry point per PRD user story 37 and the issue's
// AC: "First-run state (no documents) routes to the onboarding wizard
// automatically" + "'New document' action goes through the wizard, not
// directly to a blank workspace".
//
// Flow: pick → (optional) preview → POST /api/documents → PUT to apply the
// chosen template → router.replace to the new workspace.
export default function OnboardingPage() {
  const router = useRouter();
  // BUILT_IN_TEMPLATES is the seed. The fetch updates if the API ever returns
  // a different list (e.g. server-side overrides), but we don't block on it —
  // the wizard is the user's first impression and must render instantly.
  const [templates, setTemplates] = useState<Template[]>(BUILT_IN_TEMPLATES);
  const [busy, setBusy] = useState(false);
  // Whether the user has somewhere to cancel back to. First-run state (zero
  // documents) has no destination — the home page would just bounce them
  // straight back to /onboarding — so we hide the Cancel affordance.
  const [canCancel, setCanCancel] = useState(false);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data: { templates: Template[] }) => {
        if (data.templates && data.templates.length > 0) {
          setTemplates(data.templates);
        }
      })
      .catch(() => {
        // Built-in fallback already loaded — degraded silently.
      });

    fetch("/api/documents")
      .then((r) => r.json())
      .then((data: { documents: Array<{ id: string }> }) => {
        setCanCancel(data.documents.length > 0);
      })
      .catch(() => {
        // On error, leave canCancel=false. Worst case: no Cancel button,
        // which is the safe default — never strand a first-run user with a
        // dead button.
      });
  }, []);

  async function handleComplete(templateId: string) {
    if (busy) return;
    setBusy(true);
    try {
      const created = await fetch("/api/documents", { method: "POST" });
      const { document } = (await created.json()) as { document: Document };

      const template = templates.find((t) => t.id === templateId);
      if (template) {
        const next = applyTemplate(document, template);
        await fetch(`/api/documents/${document.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document: {
              spec: next.spec,
              outline: next.outline,
              checks: next.checks,
              draftSections: next.draftSections,
              lockedSectionIds: next.lockedSectionIds,
              outlineFrozen: next.outlineFrozen,
              templateId: next.templateId,
            },
          }),
        });
      }

      router.replace(`/documents/${document.id}`);
    } catch {
      // Stay on the wizard — the user can retry. Surface a friendlier error
      // banner in a future polish pass.
      setBusy(false);
    }
  }

  return (
    <OnboardingWizard
      templates={templates}
      busy={busy}
      onComplete={handleComplete}
      onCancel={canCancel ? () => router.push("/") : undefined}
    />
  );
}
