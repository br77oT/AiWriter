import { NextResponse } from "next/server";
import { getDefaultStore } from "@/lib/document-store";
import { validate, type ValidateProgressEvent } from "@/lib/validation";
import { recordVersion } from "@/lib/versions";
import { createRecordingProvider, getDefaultProvider } from "@/lib/llm";

// POST /api/validate { documentId }
//
// Streams NDJSON (one JSON object per line) so the client can render live
// per-check progress while the LLM evaluator works. Each check costs one
// LLM call; with N checks the response carries:
//
//   {"type":"check-start","index":0,"total":N,"checkId":"…","question":"…"}\n
//   {"type":"check-done","index":0,"total":N,"checkId":"…","result":{…}}\n
//   …repeats per check…
//   {"type":"done","report":…,"document":…,"promptLog":…}\n
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

  const recorder = createRecordingProvider(getDefaultProvider());

  // Convert the validate() callback API into a streamed NDJSON body. The
  // ReadableStream owns the lifecycle: validate() is started inside `start`
  // and the stream closes once validate() resolves and the terminal "done"
  // event has been enqueued.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const write = (event: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      const startedAt = Date.now();
      try {
        const report = await validate(
          doc.draftSections,
          doc.outline,
          doc.checks,
          {
            provider: recorder,
            onProgress: (event: ValidateProgressEvent) => write(event),
          }
        );
        const durationMs = Date.now() - startedAt;
        const updated = store.update(documentId, (existing) =>
          recordVersion(existing, "Validate", report, {
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
          report,
          document: updated,
          promptLog: {
            kind: "Validate",
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
      // application/x-ndjson is the canonical type for newline-delimited
      // JSON; the client reads body chunks via fetch() and splits on "\n".
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
