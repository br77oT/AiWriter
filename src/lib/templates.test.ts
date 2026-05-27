import { describe, it, expect } from "vitest";
import {
  BUILT_IN_TEMPLATES,
  applyTemplate,
  bundleFromDocument,
  getBuiltInTemplate,
  isDocumentEmpty,
} from "./templates";
import { newDocument, type Document } from "./types";

describe("Template Library — built-in set", () => {
  it("ships the built-in templates in the expected order, ending with Custom", () => {
    const ids = BUILT_IN_TEMPLATES.map((t) => t.id);
    expect(ids).toEqual([
      "incident-report",
      "postmortem",
      "status-report",
      "business-plan",
      "case-study",
      "business-idea",
      "project-plan",
      "release-notes",
      "custom",
    ]);
    // Custom must remain the last entry — the wizard relies on the blank
    // template appearing after the filled ones so it reads as "or start blank".
    expect(ids[ids.length - 1]).toBe("custom");
    for (const t of BUILT_IN_TEMPLATES) {
      expect(t.builtIn).toBe(true);
      expect(t.name.length).toBeGreaterThan(0);
    }
  });

  it("each filled template ships Spec defaults + Outline + Checks", () => {
    // Every built-in except the explicitly-blank Custom should be filled.
    const filled = BUILT_IN_TEMPLATES.filter((t) => t.id !== "custom");
    for (const template of filled) {
      expect(template.bundle.spec.goal.length).toBeGreaterThan(0);
      expect(template.bundle.outline.length).toBeGreaterThan(0);
      expect(template.bundle.checks.length).toBeGreaterThan(0);
      // PRD §Schema: required is the structural-evaluator gate. Filled
      // templates should mark every default section as required.
      for (const section of template.bundle.outline) {
        expect(section.required).toBe(true);
      }
    }
  });

  it("Custom template is blank (no spec / outline / checks)", () => {
    const custom = getBuiltInTemplate("custom")!;
    expect(custom.bundle.spec.goal).toBe("");
    expect(custom.bundle.outline).toEqual([]);
    expect(custom.bundle.checks).toEqual([]);
  });

  it("Incident Report includes the wireframe outline (Summary, Timeline, Root Cause, Impact, Follow-up Actions)", () => {
    // Mirrors prd/make ux wireframes.md "VALIDATION" rail example.
    const ir = getBuiltInTemplate("incident-report")!;
    const headings = ir.bundle.outline.map((s) => s.heading);
    expect(headings).toEqual([
      "Summary",
      "Timeline",
      "Root Cause",
      "Impact",
      "Follow-up Actions",
    ]);
  });

  it("Outline section IDs within a template are unique", () => {
    for (const t of BUILT_IN_TEMPLATES) {
      const ids = t.bundle.outline.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("isDocumentEmpty", () => {
  it("returns true for a freshly-created document", () => {
    const doc = newDocument("d1", "2026-04-30T00:00:00.000Z");
    expect(isDocumentEmpty(doc)).toBe(true);
  });

  it("returns false once the spec goal is set", () => {
    const doc: Document = {
      ...newDocument("d1", "2026-04-30T00:00:00.000Z"),
      spec: {
        goal: "Document the outage.",
        tone: "",
        audience: "",
        mustInclude: [],
        mustAvoid: [],
      },
    };
    expect(isDocumentEmpty(doc)).toBe(false);
  });

  it("returns false once the outline has any section", () => {
    const doc: Document = {
      ...newDocument("d1", "2026-04-30T00:00:00.000Z"),
      outline: [
        { id: "s1", heading: "Summary", description: "", required: true },
      ],
    };
    expect(isDocumentEmpty(doc)).toBe(false);
  });

  it("returns false once any check is present", () => {
    const doc: Document = {
      ...newDocument("d1", "2026-04-30T00:00:00.000Z"),
      checks: [{ id: "c1", question: "What happened?" }],
    };
    expect(isDocumentEmpty(doc)).toBe(false);
  });

  it("returns false once any draft section has non-whitespace text", () => {
    const doc: Document = {
      ...newDocument("d1", "2026-04-30T00:00:00.000Z"),
      draftSections: { summary: "Some text." },
    };
    expect(isDocumentEmpty(doc)).toBe(false);
  });

  it("treats whitespace-only draft sections as empty", () => {
    const doc: Document = {
      ...newDocument("d1", "2026-04-30T00:00:00.000Z"),
      draftSections: { summary: "   \n  " },
    };
    expect(isDocumentEmpty(doc)).toBe(true);
  });
});

describe("applyTemplate", () => {
  it("replaces spec / outline / checks with the template's bundle", () => {
    const doc = newDocument("d1", "2026-04-30T00:00:00.000Z");
    const template = getBuiltInTemplate("incident-report")!;

    const next = applyTemplate(doc, template);

    expect(next.spec.goal).toBe(template.bundle.spec.goal);
    expect(next.spec.tone).toBe(template.bundle.spec.tone);
    expect(next.spec.audience).toBe(template.bundle.spec.audience);
    expect(next.spec.mustInclude).toEqual(template.bundle.spec.mustInclude);
    expect(next.spec.mustAvoid).toEqual(template.bundle.spec.mustAvoid);
    expect(next.outline).toEqual(template.bundle.outline);
    expect(next.checks).toEqual(template.bundle.checks);
  });

  it("sets templateId to the applied template id", () => {
    const doc = newDocument("d1", "2026-04-30T00:00:00.000Z");
    const next = applyTemplate(doc, getBuiltInTemplate("postmortem")!);
    expect(next.templateId).toBe("postmortem");
  });

  it("clears draftSections, lockedSectionIds, and outlineFrozen", () => {
    const doc: Document = {
      ...newDocument("d1", "2026-04-30T00:00:00.000Z"),
      draftSections: { old: "leftover" },
      lockedSectionIds: ["old"],
      outlineFrozen: true,
    };
    const next = applyTemplate(doc, getBuiltInTemplate("status-report")!);

    expect(next.draftSections).toEqual({});
    expect(next.lockedSectionIds).toEqual([]);
    expect(next.outlineFrozen).toBe(false);
  });

  it("preserves id / title / createdAt / versions", () => {
    const doc: Document = {
      ...newDocument("d1", "2026-04-30T00:00:00.000Z"),
      title: "My custom title",
    };
    const versionsBefore = doc.versions;
    const next = applyTemplate(doc, getBuiltInTemplate("incident-report")!);
    expect(next.id).toBe(doc.id);
    expect(next.title).toBe("My custom title");
    expect(next.createdAt).toBe(doc.createdAt);
    expect(next.versions).toBe(versionsBefore);
  });

  it("does not mutate the input document or the template's bundle", () => {
    const doc = newDocument("d1", "2026-04-30T00:00:00.000Z");
    const before = JSON.stringify(doc);
    const template = getBuiltInTemplate("incident-report")!;
    const templateBefore = JSON.stringify(template);

    const next = applyTemplate(doc, template);
    next.spec.mustInclude.push("MUTATION");
    next.outline.push({
      id: "x",
      heading: "x",
      description: "",
      required: false,
    });

    expect(JSON.stringify(doc)).toBe(before);
    expect(JSON.stringify(template)).toBe(templateBefore);
  });

  it("Custom (blank) template empties the document fields", () => {
    const doc: Document = {
      ...newDocument("d1", "2026-04-30T00:00:00.000Z"),
      spec: {
        goal: "g",
        tone: "t",
        audience: "a",
        mustInclude: ["x"],
        mustAvoid: ["y"],
      },
      outline: [
        { id: "s1", heading: "Summary", description: "", required: true },
      ],
      checks: [{ id: "c1", question: "?" }],
    };
    const next = applyTemplate(doc, getBuiltInTemplate("custom")!);
    expect(next.spec.goal).toBe("");
    expect(next.outline).toEqual([]);
    expect(next.checks).toEqual([]);
    expect(next.templateId).toBe("custom");
  });
});

describe("bundleFromDocument", () => {
  it("captures spec / outline / checks for save-as-template", () => {
    const doc: Document = {
      ...newDocument("d1", "2026-04-30T00:00:00.000Z"),
      spec: {
        goal: "Track quarterly progress.",
        tone: "concise",
        audience: "execs",
        mustInclude: ["status indicator"],
        mustAvoid: ["jargon"],
      },
      outline: [
        { id: "s1", heading: "Headline", description: "", required: true },
      ],
      checks: [{ id: "c1", question: "What is the status?" }],
      // The following should NOT be captured into the template bundle.
      draftSections: { s1: "On track." },
      lockedSectionIds: ["s1"],
      outlineFrozen: true,
    };

    const bundle = bundleFromDocument(doc);

    expect(bundle.spec.goal).toBe("Track quarterly progress.");
    expect(bundle.outline).toEqual([
      { id: "s1", heading: "Headline", description: "", required: true },
    ]);
    expect(bundle.checks).toEqual([
      { id: "c1", question: "What is the status?" },
    ]);
    // Bundle has no notion of draft / lock / freeze — those are
    // document-state, not template-state.
    expect(Object.keys(bundle)).toEqual(["spec", "outline", "checks"]);
  });

  it("save-as → apply round-trips the spec/outline/checks bit-for-bit", () => {
    // Acceptance criterion: "User-saved templates round-trip — saving and
    // re-loading produces the original Spec/Outline/Checks bit-for-bit."
    const doc: Document = {
      ...newDocument("source", "2026-04-30T00:00:00.000Z"),
      spec: {
        goal: "g",
        tone: "t",
        audience: "a",
        mustInclude: ["m1", "m2"],
        mustAvoid: ["a1"],
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

    const bundle = bundleFromDocument(doc);
    const userTemplate = {
      id: "user-1",
      name: "My template",
      builtIn: false,
      bundle,
    };
    const blank = newDocument("target", "2026-04-30T00:00:00.000Z");
    const restored = applyTemplate(blank, userTemplate);

    expect(restored.spec).toEqual(doc.spec);
    expect(restored.outline).toEqual(doc.outline);
    expect(restored.checks).toEqual(doc.checks);
  });

  it("does not mutate the source document", () => {
    const doc: Document = {
      ...newDocument("d1", "2026-04-30T00:00:00.000Z"),
      spec: {
        goal: "g",
        tone: "",
        audience: "",
        mustInclude: ["m"],
        mustAvoid: [],
      },
      outline: [
        { id: "s1", heading: "Summary", description: "", required: true },
      ],
      checks: [{ id: "c1", question: "?" }],
    };
    const before = JSON.stringify(doc);
    const bundle = bundleFromDocument(doc);
    bundle.spec.mustInclude.push("MUTATION");
    bundle.outline.push({
      id: "x",
      heading: "x",
      description: "",
      required: false,
    });
    bundle.checks.push({ id: "x", question: "x" });
    expect(JSON.stringify(doc)).toBe(before);
  });
});
