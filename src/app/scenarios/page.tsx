import Link from "next/link";
import { getDefaultScenarioStore } from "@/lib/scenario-store";
import { getLlmKeyStatus } from "@/lib/llm";
import { ScenariosList } from "@/components/ScenariosList";
import { LlmKeyWarning } from "@/components/LlmKeyWarning";

// `/scenarios` — the gallery of saved scenario links. Resolved server-side
// straight from the store, the same way the document page reads its document.
export default function ScenariosPage() {
  const scenarios = getDefaultScenarioStore().list();
  const keyStatus = getLlmKeyStatus();
  return (
    <div className="flex h-full flex-col">
      {keyStatus !== "ok" && <LlmKeyWarning status={keyStatus} />}
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 overflow-y-auto p-6">
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-semibold tracking-tight">
            Scenario links
          </h1>
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
    </div>
  );
}
