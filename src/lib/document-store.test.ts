import { describe, it, expect, beforeEach } from "vitest";
import { createDocumentStore, type DocumentStore } from "./document-store";

// Each test gets a fresh in-memory database — no fixture sharing across tests.
function freshStore(): DocumentStore {
  return createDocumentStore({ filename: ":memory:" });
}

describe("DocumentStore", () => {
  let store: DocumentStore;

  beforeEach(() => {
    store = freshStore();
  });

  it("creates a blank document with all fields default-empty", () => {
    const doc = store.create();

    expect(doc.id).toMatch(/.+/);
    expect(doc.title).toBe("Untitled document");
    expect(doc.templateId).toBeNull();
    expect(doc.spec).toEqual({
      goal: "",
      tone: "",
      audience: "",
      mustInclude: [],
      mustAvoid: [],
    });
    expect(doc.outline).toEqual([]);
    expect(doc.checks).toEqual([]);
    expect(doc.draftSections).toEqual({});
    expect(doc.lockedSectionIds).toEqual([]);
    expect(doc.outlineFrozen).toBe(false);
    expect(doc.versions).toEqual([]);
    expect(doc.createdAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(doc.updatedAt).toBe(doc.createdAt);
  });

  it("retrieves a document by id", () => {
    const created = store.create();
    const fetched = store.get(created.id);

    expect(fetched).toEqual(created);
  });

  it("returns null for unknown id", () => {
    expect(store.get("does-not-exist")).toBeNull();
  });

  it("lists documents newest-first", () => {
    const a = store.create();
    // Force at least 1ms of separation so updatedAt ordering is stable.
    const future = new Date(Date.parse(a.updatedAt) + 1000).toISOString();
    const b = store.create({ now: future });

    const list = store.list();

    expect(list.map((d) => d.id)).toEqual([b.id, a.id]);
    expect(list[0]).toMatchObject({
      id: b.id,
      title: b.title,
      updatedAt: b.updatedAt,
    });
  });

  it("returns an empty list when no documents exist", () => {
    expect(store.list()).toEqual([]);
  });

  it("round-trips structured fields through update", () => {
    const created = store.create();
    const updated = store.update(created.id, (doc) => ({
      ...doc,
      title: "Postmortem 2026-Q2",
      spec: { ...doc.spec, goal: "Document the outage." },
      outline: [
        { id: "s1", heading: "Summary", description: "", required: true },
      ],
      checks: [{ id: "c1", question: "What broke?" }],
      outlineFrozen: true,
    }));

    expect(updated.title).toBe("Postmortem 2026-Q2");
    expect(updated.outlineFrozen).toBe(true);
    expect(updated.outline).toHaveLength(1);
    expect(updated.checks).toHaveLength(1);
    expect(updated.updatedAt).not.toBe(created.updatedAt);

    const refetched = store.get(created.id);
    expect(refetched).toEqual(updated);
  });
});
