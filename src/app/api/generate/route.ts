import { NextResponse } from "next/server";
import { getDefaultStore } from "@/lib/document-store";
import { generate, type GenerateProgressEvent } from "@/lib/generation";
import { recordVersion } from "@/lib/versions";
import { createRecordingProvider, getDefaultProvider } from "@/lib/llm";

// POST /api/generate { documentId }
//
// Streams NDJSON (one JSON object per line) so the client can render live
// per-section progress while the LLM works. Each section costs one LLM call;
// with N outline sections (including locked) the response carries:
//
//   {"type":"section-start","index":0,"total":N,"outlineId":"…","heading":"…"}\n
//   {"type":"section-done","index":0,"total":N,"outlineId":"…","heading":"…","text":"…"}\n
//   …repeats per section; locked sections emit only a "section-skipped" event…
//   {"type":"done","document":…,"draftSections":…,"promptLog":…}\n
//
// Per ADR 0001:
// - Persistence is incremental: after each `section-done` the new prose is
//   written into `draftSections` so a mid-run failure / disconnect / cancel
//   keeps already-finished sections.
// - A single section's LLM call throwing emits a `section-error` event but
//   does not abort the run — sibling sections still process.
// - Locked sections stay bit-identical (they emit only `section-skipped`).
//
// Or — if the requested document is missing / the body is malformed — a
// single non-stream JSON response with the appropriate 4xx status.
export async function POST(req: Request) {
  let body: { documentId?: string } = {};
  try {
    body = (await req.json()) as { documentId?: string };
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON: { documentId }" },
      { status: 400 }
    );
  }
  const documentId = body.documentId;
  if (!documentId) {
    return NextResponse.json(
      { error: "documentId is required" },
      { status: 400 }
    );
  }
  const store = getDefaultStore();
  const doc = store.get(documentId);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Wrap the provider so we can return the exact per-section prompts that
  // hit the LLM — the Prompt Inspector panel renders these.
  const recorder = createRecordingProvider(getDefaultProvider());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const write = (event: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      const startedAt = Date.now();
      try {
        await generate(doc.spec, doc.outline, doc.checks, {
          provider: recorder,
          lockedSectionIds: doc.lockedSectionIds,
          outlineFrozen: doc.outlineFrozen,
          existingDraft: doc.draftSections,
          onProgress: async (event: GenerateProgressEvent) => {
            // Incremental persistence: every successful section is written
            // to draftSections as soon as it lands. Locked sections are
            // left alone (no event-driven write). Errored sections leave
            // the prior text untouched (we never write the failing one).
            if (event.type === "section-done") {
              store.update(documentId, (existing) => ({
                ...existing,
                draftSections: {
                  ...existing.draftSections,
                  [event.outlineId]: event.text,
                },
              }));
            }
            write(event);
          },
        });

        const durationMs = Date.now() - startedAt;
        // Record the per-run Version once at the end, capturing aggregate
        // duration + token usage for the whole Generate run. Per-section
        // persistence above already wrote the prose; this snapshot just
        // adds a history entry. validationReport is null — Workspace will
        // chain Validate next when evaluateAfterEveryGeneration is on.
        const updated = store.update(documentId, (existing) =>
          recordVersion(existing, "Generate", null, {
            metrics: {
              durationMs,
              provider: recorder.kind,
              model: recorder.model,
              tokenUsage: recorder.totalUsage(),
            },
          })
        );
        write({
          type: "done",
          document: updated,
          draftSections: updated.draftSections,
          promptLog: {
            kind: "Generate",
            timestamp: new Date().toISOString(),
            exchanges: recorder.exchanges,
          },
        });
      } catch (err) {
        write({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
