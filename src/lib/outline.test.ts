import { describe, it, expect } from "vitest";
import {
  addSection,
  removeSection,
  updateSection,
  moveSection,
} from "./outline";
import type { OutlineSection } from "./types";

function section(overrides: Partial<OutlineSection> = {}): OutlineSection {
  return {
    id: overrides.id ?? "id",
    heading: overrides.heading ?? "Heading",
    description: overrides.description ?? "",
    required: overrides.required ?? true,
    ...(overrides.parentId !== undefined ? { parentId: overrides.parentId } : {}),
  };
}

describe("outline model — addSection", () => {
  it("appends a new section with a stable id and Required by default", () => {
    const before: OutlineSection[] = [section({ id: "a", heading: "A" })];
    const after = addSection(before, { id: "b", heading: "" });
    expect(after).toHaveLength(2);
    expect(after[1].id).toBe("b");
    expect(after[1].required).toBe(true);
    expect(after[1].heading).toBe("");
    expect(after[1].description).toBe("");
  });

  it("does not mutate the input array", () => {
    const before: OutlineSection[] = [section({ id: "a" })];
    const beforeSnapshot = JSON.parse(JSON.stringify(before));
    addSection(before, { id: "b" });
    expect(before).toEqual(beforeSnapshot);
  });

  it("when frozen, returns the input unchanged", () => {
    const before: OutlineSection[] = [section({ id: "a" })];
    const after = addSection(before, { id: "b" }, { frozen: true });
    expect(after).toBe(before);
  });
});

describe("outline model — removeSection", () => {
  it("removes the targeted section", () => {
    const before: OutlineSection[] = [
      section({ id: "a" }),
      section({ id: "b" }),
      section({ id: "c" }),
    ];
    const after = removeSection(before, "b");
    expect(after.map((s) => s.id)).toEqual(["a", "c"]);
  });

  it("when frozen, returns the input unchanged", () => {
    const before: OutlineSection[] = [
      section({ id: "a" }),
      section({ id: "b" }),
    ];
    const after = removeSection(before, "a", { frozen: true });
    expect(after).toBe(before);
  });
});

describe("outline model — updateSection", () => {
  it("patches heading, description, and required on the matching section only", () => {
    const before: OutlineSection[] = [
      section({ id: "a", heading: "A", description: "old", required: true }),
      section({ id: "b", heading: "B", description: "B desc", required: true }),
    ];
    const after = updateSection(before, "a", {
      heading: "A renamed",
      description: "new",
      required: false,
    });
    expect(after[0]).toEqual({
      id: "a",
      heading: "A renamed",
      description: "new",
      required: false,
    });
    expect(after[1]).toEqual(before[1]);
  });

  it("required-flag toggle round-trips", () => {
    const before: OutlineSection[] = [section({ id: "a", required: true })];
    const off = updateSection(before, "a", { required: false });
    expect(off[0].required).toBe(false);
    const on = updateSection(off, "a", { required: true });
    expect(on[0].required).toBe(true);
  });

  it("when frozen, drops heading from the patch but applies description and required", () => {
    const before: OutlineSection[] = [
      section({
        id: "a",
        heading: "A",
        description: "old",
        required: true,
      }),
    ];
    const after = updateSection(
      before,
      "a",
      { heading: "RENAMED", description: "new desc", required: false },
      { frozen: true }
    );
    expect(after[0].heading).toBe("A");
    expect(after[0].description).toBe("new desc");
    expect(after[0].required).toBe(false);
  });

  it("returns the input untouched if no patchable fields apply", () => {
    const before: OutlineSection[] = [section({ id: "a", heading: "A" })];
    const after = updateSection(before, "a", { heading: "B" }, { frozen: true });
    // heading-only patch is dropped under freeze; result equals input.
    expect(after).toEqual(before);
  });

  it("missing id is a no-op (returns input unchanged)", () => {
    const before: OutlineSection[] = [section({ id: "a" })];
    const after = updateSection(before, "missing", { heading: "x" });
    expect(after).toEqual(before);
  });
});

describe("outline model — moveSection", () => {
  it("reorders the array; section IDs are preserved", () => {
    const before: OutlineSection[] = [
      section({ id: "a", heading: "A" }),
      section({ id: "b", heading: "B" }),
      section({ id: "c", heading: "C" }),
      section({ id: "d", heading: "D" }),
    ];
    const after = moveSection(before, 0, 2);
    expect(after.map((s) => s.id)).toEqual(["b", "c", "a", "d"]);
    // Section content is preserved bit-for-bit; only position changes.
    expect(after[2]).toEqual(before[0]);
  });

  it("moving downward and upward both work", () => {
    const before: OutlineSection[] = [
      section({ id: "a" }),
      section({ id: "b" }),
      section({ id: "c" }),
    ];
    expect(moveSection(before, 2, 0).map((s) => s.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("noop when source and destination are the same index", () => {
    const before: OutlineSection[] = [section({ id: "a" }), section({ id: "b" })];
    const after = moveSection(before, 1, 1);
    expect(after.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("clamps out-of-range indices instead of throwing", () => {
    const before: OutlineSection[] = [
      section({ id: "a" }),
      section({ id: "b" }),
    ];
    expect(moveSection(before, -1, 5).map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("when frozen, returns the input unchanged", () => {
    const before: OutlineSection[] = [
      section({ id: "a" }),
      section({ id: "b" }),
    ];
    const after = moveSection(before, 0, 1, { frozen: true });
    expect(after).toBe(before);
  });
});
