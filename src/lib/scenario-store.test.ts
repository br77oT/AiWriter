import { describe, it, expect } from "vitest";
import {
  createScenarioStore,
  snapshotFromDocument,
  applySnapshotToDocument,
} from "./scenario-store";
import { newDocument, type Document } from "./types";

function sampleDoc(): Document {
  return {
    ...newDocument("doc-1", "2026-05-01T00:00:00.000Z"),
    title: "Outage report",
    outline: [
      { id: "s1", heading: "Summary", description: "", required: true },
    ],
    checks: [{ id: "c1", question: "What happened?" }],
    draftSections: { s1: "It broke." },
    lockedSectionIds: ["s1"],
    outlineFrozen: true,
    templateId: "incident-report",
  };
}

describe("scenario snapshot helpers", () => {
  it("snapshotFromDocument captures authored content, not identity/history", () => {
    const snap = snapshotFromDocument(sampleDoc());
    expect(snap.title).toBe("Outage report");
    expect(snap.draftSections).toEqual({ s1: "It broke." });
    expect(snap.lockedSectionIds).toEqual(["s1"]);
    expect(snap.outlineFrozen).toBe(true);
    expect(snap).not.toHaveProperty("id");
    expect(snap).not.toHaveProperty("versions");
  });

  it("applySnapshotToDocument overlays content but keeps the new doc identity", () => {
    const snap = snapshotFromDocument(sampleDoc());
    const fresh = newDocument("doc-NEW", "2026-06-01T00:00:00.000Z");
    const result = applySnapshotToDocument(fresh, snap);
    expect(result.id).toBe("doc-NEW");
    expect(result.createdAt).toBe("2026-06-01T00:00:00.000Z");
    expect(result.versions).toEqual([]);
    expect(result.title).toBe("Outage report");
    expect(result.outline).toHaveLength(1);
    expect(result.checks[0]!.question).toBe("What happened?");
    expect(result.draftSections).toEqual({ s1: "It broke." });
  });
});

describe("ScenarioStore", () => {
  it("round-trips a snapshot through create/get", () => {
    const store = createScenarioStore({ filename: ":memory:" });
    const snap = snapshotFromDocument(sampleDoc());
    const { code } = store.create(snap);
    expect(code).toMatch(/^[2-9a-z]{8}$/);
    expect(store.get(code)).toEqual(snap);
  });

  it("returns null for an unknown code", () => {
    const store = createScenarioStore({ filename: ":memory:" });
    expect(store.get("no-such-code")).toBeNull();
  });

  it("issues distinct codes for repeated creates", () => {
    const store = createScenarioStore({ filename: ":memory:" });
    const snap = snapshotFromDocument(sampleDoc());
    const a = store.create(snap).code;
    const b = store.create(snap).code;
    expect(a).not.toBe(b);
  });
});
