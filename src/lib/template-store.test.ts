import { describe, it, expect, beforeEach } from "vitest";
import {
  createTemplateStore,
  type TemplateStore,
} from "./template-store";
import { BUILT_IN_TEMPLATES } from "./templates";

function freshStore(): TemplateStore {
  return createTemplateStore({ filename: ":memory:" });
}

describe("TemplateStore", () => {
  let store: TemplateStore;

  beforeEach(() => {
    store = freshStore();
  });

  it("list() returns built-in templates with no user-saved templates present", () => {
    const all = store.list();
    expect(all.map((t) => t.id)).toEqual([
      "incident-report",
      "postmortem",
      "status-report",
      "custom",
    ]);
  });

  it("get() resolves built-in template ids without DB lookup", () => {
    const ir = store.get("incident-report");
    expect(ir).not.toBeNull();
    expect(ir!.builtIn).toBe(true);
    expect(ir!.name).toBe("Incident Report");
  });

  it("get() returns null for unknown id", () => {
    expect(store.get("does-not-exist")).toBeNull();
  });

  it("saveUser() persists a user template that round-trips through get()", () => {
    const saved = store.saveUser("My standup", {
      spec: {
        goal: "Daily standup notes.",
        tone: "concise",
        audience: "team",
        mustInclude: ["yesterday", "today", "blockers"],
        mustAvoid: [],
      },
      outline: [
        { id: "yesterday", heading: "Yesterday", description: "", required: true },
      ],
      checks: [{ id: "c1", question: "What did you do yesterday?" }],
    });

    expect(saved.id).toMatch(/^user-/);
    expect(saved.builtIn).toBe(false);
    expect(saved.name).toBe("My standup");

    const fetched = store.get(saved.id);
    expect(fetched).toEqual(saved);
  });

  it("saveUser() round-trips spec/outline/checks bit-for-bit", () => {
    // PRD §"Testing Decisions": Template Library — saving a custom template
    // round-trips. Acceptance criterion: bit-for-bit fidelity.
    const bundle = {
      spec: {
        goal: "g",
        tone: "t",
        audience: "a",
        mustInclude: ["m1", "m2"],
        mustAvoid: ["x"],
      },
      outline: [
        { id: "s1", heading: "S1", description: "d1", required: true },
        { id: "s2", heading: "S2", description: "d2", required: false },
      ],
      checks: [
        { id: "c1", question: "Q1" },
        { id: "c2", question: "Q2" },
      ],
    };
    const saved = store.saveUser("RT", bundle);
    const fetched = store.get(saved.id)!;
    expect(fetched.bundle).toEqual(bundle);
  });

  it("list() returns built-ins followed by user-saved (newest-first within user)", () => {
    const a = store.saveUser("A", {
      spec: { goal: "", tone: "", audience: "", mustInclude: [], mustAvoid: [] },
      outline: [],
      checks: [],
    }, { now: "2026-04-30T00:00:00.000Z" });
    const b = store.saveUser("B", {
      spec: { goal: "", tone: "", audience: "", mustInclude: [], mustAvoid: [] },
      outline: [],
      checks: [],
    }, { now: "2026-04-30T01:00:00.000Z" });

    const all = store.list();
    // Built-ins first, in their declared order.
    expect(all.slice(0, BUILT_IN_TEMPLATES.length).map((t) => t.id)).toEqual([
      "incident-report",
      "postmortem",
      "status-report",
      "custom",
    ]);
    // Then user templates, newest first.
    const userOnly = all.slice(BUILT_IN_TEMPLATES.length);
    expect(userOnly.map((t) => t.id)).toEqual([b.id, a.id]);
  });

  it("user template ids are namespaced and never collide with built-in slugs", () => {
    const saved = store.saveUser("Custom", {
      spec: { goal: "", tone: "", audience: "", mustInclude: [], mustAvoid: [] },
      outline: [],
      checks: [],
    });
    expect(saved.id.startsWith("user-")).toBe(true);
    expect(saved.id).not.toBe("custom");
    expect(saved.id).not.toBe("incident-report");
  });
});
