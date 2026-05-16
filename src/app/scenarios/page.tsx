import Link from "next/link";
import { getDefaultScenarioStore } from "@/lib/scenario-store";
import { ScenariosList } from "@/components/ScenariosList";

// `/scenarios` — the gallery of saved scenario links. Resolved server-side
// straight from the store, the same way the document page reads its document.
export default function ScenariosPage() {
  const scenarios = getDefaultScenarioStore().list();
  return (
    <main className="mx-auto flex h-full max-w-2xl flex-col gap-4 overflow-y-auto p-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Scenario links</h1>
        <Link href="/" className="text-sm text-neutral-600 hover:underline">
          ← Back to workspace
        </Link>
      </div>
      <p className="text-sm text-neutral-600">
        Each link recreates its document — spec, outline, checks and draft —
        then auto-runs Generate and Validate.
      </p>
      <ScenariosList scenarios={scenarios} />
    </main>
  );
}
