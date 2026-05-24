import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createDocumentStore,
  setDefaultStoreForTesting,
} from "@/lib/document-store";
import {
  createScriptedProvider,
  setDefaultProviderForTesting,
} from "@/lib/llm";
import { POST as validatePOST } from "./route";

// Drain the streaming NDJSON body and return every parsed event. Tests use
// this to wait for the work to finish (so the store mutation is observable)
// and to inspect the per-check progress + final 'done' payload.
async function drain(res: Response): Promise<Array<Record<string, unknown>>> {
  if (!res.body) return [];
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const events: Array<Record<string, unknown>> = [];
  let buffer = "";
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (line.trim() !== "") events.push(JSON.parse(line));
    }
  }
  return events;
}

function findDone(events: Array<Record<string, unknown>>): Record<string, unknown> {
  const done = events.find((e) => e.type === "done");
  if (!done) throw new Error("No 'done' event in stream");
  return done;
}

describe("POST /api/validate", () => {
  beforeEach(() => {
    setDefaultStoreForTesting(createDocumentStore({ filename: ":memory:" }));
    setDefaultProviderForTesting(
      createScriptedProvider(() =>
        JSON.stringify({
          status: "answered",
          evidence: "Pipe burst at 03:15.",
          suggestion: null,
        })
      )
    );
  });

  afterEach(() => {
    setDefaultStoreForTesting(null);
    setDefaultProviderForTesting(null);
  });

  it("returns a ValidationReport for a stored document", async () => {
    const store = (await import("@/lib/document-store")).getDefaultStore();
    const created = store.create();
    store.update(created.id, (doc) => ({
      ...doc,
      outline: [
        { id: "summary", heading: "Summary", description: "", required: true },
      ],
      checks: [{ id: "c1", question: "What happened?" }],
      draftSections: { summary: "Pipe burst at 03:15 in the basement." },
    }));

    const res = await validatePOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({ documentId: created.id }),
      })
    );
    expect(res.status).toBe(200);
    const events = await drain(res);
    // One check → one start + one done + the terminal done event.
    expect(events.filter((e) => e.type === "check-start")).toHaveLength(1);
    expect(events.filter((e) => e.type === "check-done")).toHaveLength(1);
    const report = (findDone(events).report as {
      structure: Array<unknown>;
      questions: Array<{ status: string }>;
      coverageScore: { checksAnswered: number; checksTotal: number };
    });
    expect(report.structure).toHaveLength(1);
    expect((report.structure[0] as { outlineId: string }).outlineId).toBe(
      "summary"
    );
    expect(report.questions).toHaveLength(1);
    expect(report.questions[0]!.status).toBe("answered");
    expect(report.coverageScore).toMatchObject({
      checksAnswered: 1,
      checksTotal: 1,
    });
  });

  it("records a 'Validate' version including the fresh report (slice 011)", async () => {
    const store = (await import("@/lib/document-store")).getDefaultStore();
    const created = store.create();
    store.update(created.id, (doc) => ({
      ...doc,
      outline: [
        { id: "summary", heading: "Summary", description: "", required: true },
      ],
      checks: [{ id: "c1", question: "What happened?" }],
      draftSections: { summary: "Pipe burst at 03:15 in the basement." },
    }));

    const res = await validatePOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({ documentId: created.id }),
      })
    );
    expect(res.status).toBe(200);
    // Drain the stream so the route finishes its work (validate() runs
    // inside the stream's start() — without consuming the body the store
    // mutation below isn't observable yet).
    await drain(res);
    const persisted = store.get(created.id)!;
    expect(persisted.versions).toHaveLength(1);
    expect(persisted.versions[0]!.label).toBe("Validate");
    expect(persisted.versions[0]!.validationReport).not.toBeNull();
    expect(persisted.versions[0]!.validationReport!.questions).toHaveLength(1);
  });

  it("404s on unknown document id", async () => {
    const res = await validatePOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({ documentId: "no-such-id" }),
      })
    );
    expect(res.status).toBe(404);
  });

  it("400s when documentId is missing", async () => {
    const res = await validatePOST(
      new Request("http://t/", { method: "POST", body: "{}" })
    );
    expect(res.status).toBe(400);
  });
});
