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

describe("POST /api/generate", () => {
  beforeEach(() => {
    setDefaultStoreForTesting(createDocumentStore({ filename: ":memory:" }));
    setDefaultProviderForTesting(scriptedHeadingProvider());
  });

  afterEach(() => {
    setDefaultStoreForTesting(null);
    setDefaultProviderForTesting(null);
  });

  it("generates one section per outline ID and persists the draft", async () => {
    const store = getDefaultStore();
    const created = store.create();
    store.update(created.id, (doc) => ({
      ...doc,
      outline: [
        {
          id: "summary",
          heading: "Summary",
          description: "",
          required: true,
        },
        {
          id: "timeline",
          heading: "Timeline",
          description: "",
          required: true,
        },
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

    const data = (await res.json()) as {
      document: { draftSections: Record<string, string> };
      draftSections: Record<string, string>;
    };
    expect(data.draftSections.summary).toBe("Drafted: Summary");
    expect(data.draftSections.timeline).toBe("Drafted: Timeline");

    const persisted = store.get(created.id)!;
    expect(persisted.draftSections.summary).toBe("Drafted: Summary");
    expect(persisted.draftSections.timeline).toBe("Drafted: Timeline");
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

    await generatePOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({ documentId: created.id }),
      })
    );

    const after = store.get(created.id)!;
    expect(after.spec).toEqual(before.spec);
    expect(after.outline).toEqual(before.outline);
  });

  it("preserves locked sections during full-draft generation", async () => {
    const store = getDefaultStore();
    const created = store.create();
    store.update(created.id, (doc) => ({
      ...doc,
      outline: [
        {
          id: "summary",
          heading: "Summary",
          description: "",
          required: true,
        },
        {
          id: "timeline",
          heading: "Timeline",
          description: "",
          required: true,
        },
      ],
      lockedSectionIds: ["timeline"],
      draftSections: { timeline: "MANUAL TIMELINE — KEEP" },
    }));

    await generatePOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({ documentId: created.id }),
      })
    );

    const after = store.get(created.id)!;
    expect(after.draftSections.timeline).toBe("MANUAL TIMELINE — KEEP");
    expect(after.draftSections.summary).toBe("Drafted: Summary");
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

    await generatePOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({ documentId: created.id }),
      })
    );

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
