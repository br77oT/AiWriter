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
import { POST as sectionPOST } from "./route";

function scriptedProvider() {
  return createScriptedProvider((req) => {
    const userMsg =
      req.messages.find((m) => m.role === "user")?.content ?? "";
    const m = userMsg.match(
      /Rewrite the section "([^"]+)"|Expand the section "([^"]+)"/
    );
    const heading = m?.[1] ?? m?.[2] ?? "Section";
    return `New text for ${heading}.`;
  });
}

function seedDoc() {
  const store = getDefaultStore();
  const created = store.create();
  return store.update(created.id, (doc) => ({
    ...doc,
    spec: { ...doc.spec, goal: "Document the outage." },
    outline: [
      {
        id: "summary",
        heading: "Summary",
        description: "",
        required: true,
      },
      {
        id: "impact",
        heading: "Impact",
        description: "",
        required: true,
      },
    ],
    checks: [{ id: "c1", question: "What happened?" }],
    draftSections: {
      summary: "Original summary text.",
      impact: "Original impact text.",
    },
  }));
}

describe("POST /api/generate/section", () => {
  beforeEach(() => {
    setDefaultStoreForTesting(createDocumentStore({ filename: ":memory:" }));
    setDefaultProviderForTesting(scriptedProvider());
  });

  afterEach(() => {
    setDefaultStoreForTesting(null);
    setDefaultProviderForTesting(null);
  });

  it("rewrite mode replaces only the target section; siblings are bit-identical", async () => {
    const doc = seedDoc();
    const res = await sectionPOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({
          documentId: doc.id,
          outlineId: "impact",
          mode: "rewrite",
          instruction: "tighten",
        }),
      })
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      sectionText: string;
      outlineId: string;
      document: { draftSections: Record<string, string> };
    };
    expect(data.outlineId).toBe("impact");
    expect(data.sectionText).toBe("New text for Impact.");

    const persisted = getDefaultStore().get(doc.id)!;
    expect(persisted.draftSections.impact).toBe("New text for Impact.");
    // The sibling section is bit-identical with the seed value.
    expect(persisted.draftSections.summary).toBe("Original summary text.");
  });

  it("expand mode is wired through and replaces only the target section", async () => {
    const doc = seedDoc();
    await sectionPOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({
          documentId: doc.id,
          outlineId: "impact",
          mode: "expand",
        }),
      })
    );
    const persisted = getDefaultStore().get(doc.id)!;
    expect(persisted.draftSections.impact).toBe("New text for Impact.");
    expect(persisted.draftSections.summary).toBe("Original summary text.");
  });

  it("refuses to rewrite a locked section (409)", async () => {
    const doc = seedDoc();
    getDefaultStore().update(doc.id, (d) => ({
      ...d,
      lockedSectionIds: ["impact"],
    }));
    const res = await sectionPOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({
          documentId: doc.id,
          outlineId: "impact",
          mode: "rewrite",
          instruction: "tighten",
        }),
      })
    );
    expect(res.status).toBe(409);
    const persisted = getDefaultStore().get(doc.id)!;
    // Original text untouched.
    expect(persisted.draftSections.impact).toBe("Original impact text.");
  });

  it("does not modify spec or outline (PRD user story 40)", async () => {
    const doc = seedDoc();
    const before = getDefaultStore().get(doc.id)!;
    await sectionPOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({
          documentId: doc.id,
          outlineId: "impact",
          mode: "rewrite",
          instruction: "tighten",
        }),
      })
    );
    const after = getDefaultStore().get(doc.id)!;
    expect(after.spec).toEqual(before.spec);
    expect(after.outline).toEqual(before.outline);
    expect(after.checks).toEqual(before.checks);
  });

  it("404s on unknown document id", async () => {
    const res = await sectionPOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({
          documentId: "nope",
          outlineId: "impact",
          mode: "rewrite",
        }),
      })
    );
    expect(res.status).toBe(404);
  });

  it("400s when outlineId is missing", async () => {
    const doc = seedDoc();
    const res = await sectionPOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({ documentId: doc.id, mode: "rewrite" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("400s when mode is invalid", async () => {
    const doc = seedDoc();
    const res = await sectionPOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({
          documentId: doc.id,
          outlineId: "impact",
          mode: "delete",
        }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("400s when outlineId is not in the outline", async () => {
    const doc = seedDoc();
    const res = await sectionPOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({
          documentId: doc.id,
          outlineId: "missing",
          mode: "rewrite",
        }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("400s on invalid JSON body", async () => {
    const res = await sectionPOST(
      new Request("http://t/", { method: "POST", body: "not json" })
    );
    expect(res.status).toBe(400);
  });
});
