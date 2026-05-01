import { describe, it, expect } from "vitest";
import {
  recordVersion,
  restoreVersion,
  diffVersions,
  listVersionsNewestFirst,
} from "./index";
import { newDocument, type Version, type ValidationReport } from "../types";

const REPORT: ValidationReport = {
  structure: [{ outlineId: "summary", status: "present" }],
  questions: [{ checkId: "c1", status: "answered", evidence: "x" }],
  coverageScore: {
    checksAnswered: 1,
    checksTotal: 1,
    sectionsPresent: 1,
    sectionsTotal: 1,
  },
};

describe("recordVersion", () => {
  it("appends a new Version with the given label and snapshot", () => {
    const doc = {
      ...newDocument("d1", "2026-04-30T00:00:00.000Z"),
      draftSections: { summary: "First draft." },
    };
    const next = recordVersion(doc, "Generate", REPORT, {
      id: "v1",
      now: "2026-04-30T01:00:00.000Z",
    });
    expect(next.versions).toHaveLength(1);
    expect(next.versions[0]).toEqual<Version>({
      id: "v1",
      label: "Generate",
      timestamp: "2026-04-30T01:00:00.000Z",
      draftSections: { summary: "First draft." },
      validationReport: REPORT,
    });
  });

  it("preserves prior versions and appends to the list", () => {
    const seed = {
      ...newDocument("d1", "2026-04-30T00:00:00.000Z"),
      versions: [
        {
          id: "v1",
          label: "Generate",
          timestamp: "2026-04-30T00:30:00.000Z",
          draftSections: { summary: "v1 text" },
          validationReport: null,
        },
      ],
    };
    const next = recordVersion(seed, "Validate", REPORT, {
      id: "v2",
      now: "2026-04-30T01:00:00.000Z",
    });
    expect(next.versions.map((v) => v.id)).toEqual(["v1", "v2"]);
  });

  it("snapshots a deep copy of draftSections so subsequent mutations don't bleed in", () => {
    const doc = {
      ...newDocument("d1", "2026-04-30T00:00:00.000Z"),
      draftSections: { summary: "snapshot text" },
    };
    const next = recordVersion(doc, "Generate", null, {
      id: "v1",
      now: "2026-04-30T01:00:00.000Z",
    });
    // Mutate the live document's draft after the snapshot.
    next.draftSections.summary = "mutated";
    expect(next.versions[0].draftSections.summary).toBe("snapshot text");
  });

  it("accepts a null validationReport (no-validate-yet snapshot)", () => {
    const doc = newDocument("d1", "2026-04-30T00:00:00.000Z");
    const next = recordVersion(doc, "Generate", null, {
      id: "v1",
      now: "2026-04-30T01:00:00.000Z",
    });
    expect(next.versions[0].validationReport).toBeNull();
  });

  it("does not mutate the input document", () => {
    const doc = {
      ...newDocument("d1", "2026-04-30T00:00:00.000Z"),
      draftSections: { summary: "original" },
    };
    const before = JSON.stringify(doc);
    recordVersion(doc, "Generate", null, {
      id: "v1",
      now: "2026-04-30T01:00:00.000Z",
    });
    expect(JSON.stringify(doc)).toBe(before);
  });
});

describe("listVersionsNewestFirst", () => {
  it("returns versions in reverse-chronological order regardless of stored order", () => {
    const versions: Version[] = [
      {
        id: "v1",
        label: "Generate",
        timestamp: "2026-04-30T00:30:00.000Z",
        draftSections: {},
        validationReport: null,
      },
      {
        id: "v2",
        label: "Validate",
        timestamp: "2026-04-30T01:00:00.000Z",
        draftSections: {},
        validationReport: null,
      },
      {
        id: "v3",
        label: "Auto-fix: questions",
        timestamp: "2026-04-30T00:45:00.000Z",
        draftSections: {},
        validationReport: null,
      },
    ];
    const sorted = listVersionsNewestFirst(versions);
    expect(sorted.map((v) => v.id)).toEqual(["v2", "v3", "v1"]);
  });
});

describe("diffVersions", () => {
  function v(
    draftSections: Record<string, string>,
    label = "Generate"
  ): Version {
    return {
      id: "x",
      label,
      timestamp: "2026-04-30T00:00:00.000Z",
      draftSections,
      validationReport: null,
    };
  }

  it("flags added, removed, changed, and unchanged outline sections", () => {
    const a = v({
      summary: "Same text.",
      timeline: "Old timeline.",
      removed: "Was here.",
    });
    const b = v({
      summary: "Same text.",
      timeline: "New timeline.",
      added: "Brand new.",
    });
    const diff = diffVersions(a, b);
    const byId = Object.fromEntries(diff.map((d) => [d.outlineId, d]));
    expect(byId.summary.status).toBe("unchanged");
    expect(byId.timeline.status).toBe("changed");
    expect(byId.timeline.before).toBe("Old timeline.");
    expect(byId.timeline.after).toBe("New timeline.");
    expect(byId.added.status).toBe("added");
    expect(byId.added.before).toBe("");
    expect(byId.added.after).toBe("Brand new.");
    expect(byId.removed.status).toBe("removed");
    expect(byId.removed.before).toBe("Was here.");
    expect(byId.removed.after).toBe("");
  });

  it("treats whitespace-only difference as 'changed' (no special collapsing)", () => {
    const a = v({ summary: "Hello." });
    const b = v({ summary: "Hello.\n" });
    const diff = diffVersions(a, b);
    expect(diff[0].status).toBe("changed");
  });

  it("returns an empty diff for two identical drafts", () => {
    const a = v({ summary: "Same." });
    const b = v({ summary: "Same." });
    const diff = diffVersions(a, b);
    expect(diff.every((d) => d.status === "unchanged")).toBe(true);
  });
});

describe("restoreVersion", () => {
  const doc = {
    ...newDocument("d1", "2026-04-30T00:00:00.000Z"),
    outline: [
      { id: "summary", heading: "Summary", description: "", required: true },
      { id: "impact", heading: "Impact", description: "", required: true },
    ],
    draftSections: { summary: "Current.", impact: "Current impact." },
    versions: [
      {
        id: "v1",
        label: "Generate",
        timestamp: "2026-04-30T00:30:00.000Z",
        draftSections: { summary: "Old summary.", impact: "Old impact." },
        validationReport: REPORT,
      },
    ],
  };

  it("replaces draftSections with the chosen version's snapshot", () => {
    const next = restoreVersion(doc, "v1", {
      id: "v2",
      now: "2026-04-30T01:00:00.000Z",
    });
    expect(next.draftSections).toEqual({
      summary: "Old summary.",
      impact: "Old impact.",
    });
  });

  it("records a new 'Restore' version reflecting the restore event", () => {
    const next = restoreVersion(doc, "v1", {
      id: "v2",
      now: "2026-04-30T01:00:00.000Z",
    });
    expect(next.versions.map((v) => v.id)).toEqual(["v1", "v2"]);
    const newest = next.versions[1];
    expect(newest.label).toMatch(/^Restore/);
    expect(newest.draftSections).toEqual({
      summary: "Old summary.",
      impact: "Old impact.",
    });
  });

  it("round-trips: live draftSections after restore equals the version's draftSections", () => {
    const next = restoreVersion(doc, "v1", {
      id: "v2",
      now: "2026-04-30T01:00:00.000Z",
    });
    const versionToRestore = doc.versions.find((v) => v.id === "v1")!;
    expect(next.draftSections).toEqual(versionToRestore.draftSections);
  });

  it("throws when the version id is not found", () => {
    expect(() =>
      restoreVersion(doc, "no-such-id", {
        id: "v2",
        now: "2026-04-30T01:00:00.000Z",
      })
    ).toThrow(/not found/i);
  });

  it("does not mutate the input document", () => {
    const before = JSON.stringify(doc);
    restoreVersion(doc, "v1", {
      id: "v2",
      now: "2026-04-30T01:00:00.000Z",
    });
    expect(JSON.stringify(doc)).toBe(before);
  });
});
