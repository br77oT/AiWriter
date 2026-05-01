import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createDocumentStore,
  getDefaultStore,
  setDefaultStoreForTesting,
} from "@/lib/document-store";
import { POST as restorePOST } from "./route";

function ctx(id: string, versionId: string) {
  return { params: Promise.resolve({ id, versionId }) };
}

describe("POST /api/documents/:id/versions/:versionId/restore", () => {
  beforeEach(() => {
    setDefaultStoreForTesting(createDocumentStore({ filename: ":memory:" }));
  });

  afterEach(() => {
    setDefaultStoreForTesting(null);
  });

  it("replaces draftSections with the chosen version's snapshot and records a Restore version", async () => {
    const store = getDefaultStore();
    const created = store.create();
    const doc = store.update(created.id, (d) => ({
      ...d,
      outline: [
        { id: "summary", heading: "Summary", description: "", required: true },
      ],
      draftSections: { summary: "Live current text." },
      versions: [
        {
          id: "v1",
          label: "Generate",
          timestamp: "2026-04-30T00:30:00.000Z",
          draftSections: { summary: "Old generated text." },
          validationReport: null,
        },
      ],
    }));

    const res = await restorePOST(
      new Request("http://t/", { method: "POST" }),
      ctx(doc.id, "v1")
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      document: {
        draftSections: Record<string, string>;
        versions: Array<{ id: string; label: string }>;
      };
    };
    expect(data.document.draftSections.summary).toBe("Old generated text.");
    expect(data.document.versions.map((v) => v.label)).toEqual([
      "Generate",
      "Restore: Generate",
    ]);

    const persisted = store.get(doc.id)!;
    expect(persisted.draftSections.summary).toBe("Old generated text.");
  });

  it("does not modify spec, outline, or checks (PRD user story 40)", async () => {
    const store = getDefaultStore();
    const created = store.create();
    const before = store.update(created.id, (d) => ({
      ...d,
      spec: { ...d.spec, goal: "Document the outage." },
      outline: [
        { id: "summary", heading: "Summary", description: "", required: true },
      ],
      checks: [{ id: "c1", question: "What happened?" }],
      draftSections: { summary: "Live current text." },
      versions: [
        {
          id: "v1",
          label: "Generate",
          timestamp: "2026-04-30T00:30:00.000Z",
          draftSections: { summary: "Old text." },
          validationReport: null,
        },
      ],
    }));

    await restorePOST(
      new Request("http://t/", { method: "POST" }),
      ctx(before.id, "v1")
    );

    const after = store.get(before.id)!;
    expect(after.spec).toEqual(before.spec);
    expect(after.outline).toEqual(before.outline);
    expect(after.checks).toEqual(before.checks);
  });

  it("404s on unknown document id", async () => {
    const res = await restorePOST(
      new Request("http://t/", { method: "POST" }),
      ctx("does-not-exist", "v1")
    );
    expect(res.status).toBe(404);
  });

  it("404s on unknown version id", async () => {
    const store = getDefaultStore();
    const created = store.create();
    const res = await restorePOST(
      new Request("http://t/", { method: "POST" }),
      ctx(created.id, "no-such-version")
    );
    expect(res.status).toBe(404);
  });
});
