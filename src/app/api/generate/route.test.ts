import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createDocumentStore,
  getDefaultStore,
  setDefaultStoreForTesting,
} from "@/lib/document-store";
import {
  createScriptedProvider,
  setDefaultProviderForTesting,
} from "@/lib/llm";
import { POST as generatePOST } from "./route";

function scriptedHeadingProvider() {
  return createScriptedProvider((req) => {
    const userMsg =
      req.messages.find((m) => m.role === "user")?.content ?? "";
    const m = userMsg.match(/Write the section "([^"]+)"/);
    const heading = m?.[1] ?? "Section";
    return `Drafted: ${heading}`;
  });
}

// Drain the streaming NDJSON body and return every parsed event. Tests use
// this both to wait for the work to finish (so store mutations are
// observable) and to inspect per-section progress events.
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

describe("POST /api/generate", () => {
  beforeEach(() => {
    setDefaultStoreForTesting(createDocumentStore({ filename: ":memory:" }));
    setDefaultProviderForTesting(scriptedHeadingProvider());
  });

  afterEach(() => {
    setDefaultStoreForTesting(null);
    setDefaultProviderForTesting(null);
  });

  it("streams one section-start + section-done per outline ID and persists the draft", async () => {
    const store = getDefaultStore();
    const created = store.create();
    store.update(created.id, (doc) => ({
      ...doc,
      outline: [
        { id: "summary", heading: "Summary", description: "", required: true },
        { id: "timeline", heading: "Timeline", description: "", required: true },
      ],
      checks: [{ id: "c1", question: "What happened?" }],
    }));

    const res = await generatePOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({ documentId: created.id }),
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");

    const events = await drain(res);
    // Per-section: start + done for both sections, plus a final done.
    const starts = events.filter((e) => e.type === "section-start");
    const dones = events.filter((e) => e.type === "section-done");
    expect(starts.map((e) => e.outlineId)).toEqual(["summary", "timeline"]);
    expect(dones.map((e) => e.outlineId)).toEqual(["summary", "timeline"]);
    expect((dones[0] as { text: string }).text).toBe("Drafted: Summary");

    const done = findDone(events) as {
      draftSections: Record<string, string>;
    };
    expect(done.draftSections.summary).toBe("Drafted: Summary");
    expect(done.draftSections.timeline).toBe("Drafted: Timeline");

    const persisted = store.get(created.id)!;
    expect(persisted.draftSections.summary).toBe("Drafted: Summary");
    expect(persisted.draftSections.timeline).toBe("Drafted: Timeline");
  });

  it("returns a promptLog with the exact prompt sent per section", async () => {
    const store = getDefaultStore();
    const created = store.create();
    store.update(created.id, (doc) => ({
      ...doc,
      outline: [
        { id: "summary", heading: "Summary", description: "", required: true },
        { id: "timeline", heading: "Timeline", description: "", required: true },
      ],
    }));

    const res = await generatePOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({ documentId: created.id }),
      })
    );
    const events = await drain(res);
    const done = findDone(events) as {
      promptLog: {
        kind: string;
        exchanges: Array<{
          systemPrompt: string;
          messages: Array<{ role: string; content: string }>;
          response: string;
        }>;
      };
    };
    expect(done.promptLog.kind).toBe("Generate");
    expect(done.promptLog.exchanges).toHaveLength(2);
    const first = done.promptLog.exchanges[0]!;
    expect(first.systemPrompt).toContain("structured document drafter");
    expect(first.messages[0]!.content).toContain('Write the section "Summary"');
    expect(first.response).toBe("Drafted: Summary");
  });

  it("does not modify spec or outline (PRD user story 40)", async () => {
    const store = getDefaultStore();
    const created = store.create();
    const before = store.update(created.id, (doc) => ({
      ...doc,
      spec: {
        ...doc.spec,
        goal: "Document the outage.",
        mustInclude: ["affected services"],
      },
      outline: [
        {
          id: "summary",
          heading: "Summary",
          description: "Short summary",
          required: true,
        },
      ],
    }));

    const res = await generatePOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({ documentId: created.id }),
      })
    );
    await drain(res);

    const after = store.get(created.id)!;
    expect(after.spec).toEqual(before.spec);
    expect(after.outline).toEqual(before.outline);
  });

  it("emits a section-skipped event for locked sections and preserves their prose", async () => {
    const store = getDefaultStore();
    const created = store.create();
    store.update(created.id, (doc) => ({
      ...doc,
      outline: [
        { id: "summary", heading: "Summary", description: "", required: true },
        { id: "timeline", heading: "Timeline", description: "", required: true },
      ],
      lockedSectionIds: ["timeline"],
      draftSections: { timeline: "MANUAL TIMELINE — KEEP" },
    }));

    const res = await generatePOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({ documentId: created.id }),
      })
    );
    const events = await drain(res);

    const skipped = events.filter((e) => e.type === "section-skipped");
    expect(skipped).toHaveLength(1);
    expect((skipped[0] as { outlineId: string; reason: string }).outlineId).toBe(
      "timeline"
    );
    expect((skipped[0] as { reason: string }).reason).toBe("locked");

    const after = store.get(created.id)!;
    expect(after.draftSections.timeline).toBe("MANUAL TIMELINE — KEEP");
    expect(after.draftSections.summary).toBe("Drafted: Summary");
  });

  it("persists each section as soon as its section-done event fires (partial state survives failure)", async () => {
    const store = getDefaultStore();
    const created = store.create();
    store.update(created.id, (doc) => ({
      ...doc,
      outline: [
        { id: "summary", heading: "Summary", description: "", required: true },
        { id: "timeline", heading: "Timeline", description: "", required: true },
      ],
    }));

    // After draining: summary persisted before timeline starts is hard to
    // observe directly; instead assert that by the time the second
    // section-start fires, the first section is already on disk.
    let summaryAtTimelineStart: string | undefined;
    setDefaultProviderForTesting(
      createScriptedProvider((req) => {
        const heading = req.messages[0]!.content.match(
          /Write the section "([^"]+)"/
        )?.[1];
        if (heading === "Timeline") {
          summaryAtTimelineStart = store.get(created.id)?.draftSections.summary;
        }
        return `Drafted: ${heading}`;
      })
    );

    const res = await generatePOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({ documentId: created.id }),
      })
    );
    await drain(res);
    expect(summaryAtTimelineStart).toBe("Drafted: Summary");
  });

  it("records a 'Generate' version with the new draftSections (slice 011)", async () => {
    const store = getDefaultStore();
    const created = store.create();
    store.update(created.id, (doc) => ({
      ...doc,
      outline: [
        { id: "summary", heading: "Summary", description: "", required: true },
      ],
    }));

    const res = await generatePOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({ documentId: created.id }),
      })
    );
    await drain(res);

    const persisted = store.get(created.id)!;
    expect(persisted.versions).toHaveLength(1);
    expect(persisted.versions[0].label).toBe("Generate");
    expect(persisted.versions[0].draftSections).toEqual({
      summary: "Drafted: Summary",
    });
    // Generate runs before validation; report is null on this version.
    expect(persisted.versions[0].validationReport).toBeNull();
  });

  it("404s on unknown document id", async () => {
    const res = await generatePOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({ documentId: "does-not-exist" }),
      })
    );
    expect(res.status).toBe(404);
  });

  it("400s when documentId is missing", async () => {
    const res = await generatePOST(
      new Request("http://t/", { method: "POST", body: "{}" })
    );
    expect(res.status).toBe(400);
  });

  it("400s on invalid JSON body", async () => {
    const res = await generatePOST(
      new Request("http://t/", { method: "POST", body: "not json" })
    );
    expect(res.status).toBe(400);
  });
});
