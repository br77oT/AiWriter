"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const LAST_OPENED_KEY = "aiwriter:lastOpenedDocId";

// Root entry: resolve which document to land on. Order:
// 1. localStorage `lastOpenedDocId` if it still exists in the API.
// 2. First document in the list (newest first).
// 3. Create a fresh blank document and route to it.
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

      setStatus("Creating your first document…");
      const created = await fetch("/api/documents", { method: "POST" });
      const { document } = (await created.json()) as {
        document: { id: string };
      };
      if (cancelled) return;
      router.replace(`/documents/${document.id}`);
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
