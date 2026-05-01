"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const LAST_OPENED_KEY = "aiwriter:lastOpenedDocId";

// Root entry: resolve which document to land on. Order:
// 1. localStorage `lastOpenedDocId` if it still exists in the API.
// 2. First document in the list (newest first).
// 3. Zero documents → route to the first-run onboarding wizard instead of
//    creating a blank document. PRD user story 37 / issue 010 AC:
//    "First-run state (no documents) routes to the onboarding wizard
//    automatically."
export default function HomePage() {
  const router = useRouter();
  const [status, setStatus] = useState("Opening your workspace…");

  useEffect(() => {
    let cancelled = false;
    async function resolveDestination() {
      const res = await fetch("/api/documents");
      const { documents } = (await res.json()) as {
        documents: Array<{ id: string }>;
      };
      if (cancelled) return;

      const lastOpened = localStorage.getItem(LAST_OPENED_KEY);
      if (lastOpened && documents.some((d) => d.id === lastOpened)) {
        router.replace(`/documents/${lastOpened}`);
        return;
      }

      if (documents.length > 0) {
        router.replace(`/documents/${documents[0].id}`);
        return;
      }

      router.replace("/onboarding");
    }

    resolveDestination().catch(() => {
      if (!cancelled) setStatus("Failed to load workspace.");
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex h-full items-center justify-center text-sm text-neutral-500">
      {status}
    </main>
  );
}
