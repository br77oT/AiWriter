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
import { POST as autofixPOST } from "./route";

// One scripted provider serves both:
// - Validation Engine calls: prompt has "Question: <q>\n\nDraft:\n…" — return
//   JSON keyed off the configured questionMap.
// - Generation Engine section-rewrite calls: prompt mentions
//   `Rewrite the section "X"` (slice 007 prompt shape) — return canned text.
function combinedProvider(opts: {
  questionMap: Record<string, unknown>;
}) {
  return createScriptedProvider((req) => {
    const userMsg =
      req.messages.find((m) => m.role === "user")?.content ?? "";

    // Generation: section rewrite/expand path.
    const genMatch = userMsg.match(
      /Rewrite the section "([^"]+)"|Expand the section "([^"]+)"/
    );
    if (genMatch) {
      const heading = genMatch[1] ?? genMatch[2] ?? "Section";
      return `Regenerated text for ${heading}.`;
    }

    // Validation: question evaluator.
    if (userMsg.startsWith("Question: ") && userMsg.includes("\n\nDraft:")) {
      for (const q of Object.keys(opts.questionMap)) {
        if (userMsg.includes(q)) {
          return JSON.stringify(opts.questionMap[q]);
        }
      }
      return JSON.stringify({
        status: "missing",
        suggestion: "Add an answer.",
      });
    }

    // Default: empty.
    return "";
  });
}

const SUMMARY = {
  id: "summary",
  heading: "Summary",
  description: "",
  required: true,
};
const TIMELINE = {
  id: "timeline",
  heading: "Timeline",
  description: "",
  required: true,
};
const IMPACT = {
  id: "impact",
  heading: "Impact",
  description: "",
  required: true,
};

describe("POST /api/autofix — questions mode (Auto-fix missing items)", () => {
  beforeEach(() => {
    setDefaultStoreForTesting(
      createDocumentStore({ filename: ":memory:" })
    );
  });

  afterEach(() => {
    setDefaultStoreForTesting(null);
    setDefaultProviderForTesting(null);
  });

  it("regenerates only sections whose draft contains evidence from a partial check", async () => {
    setDefaultProviderForTesting(
      combinedProvider({
        questionMap: {
          "Who was affected?": {
            status: "partial",
            evidence: "staff on floor 3",
            suggestion: "Add exact roles and departments impacted.",
          },
          "What happened?": {
            status: "answered",
            evidence: "smoke event triggered evacuation",
            suggestion: null,
          },
        },
      })
    );
    const store = getDefaultStore();
    const created = store.create();
    const doc = store.update(created.id, (d) => ({
      ...d,
      outline: [SUMMARY, TIMELINE, IMPACT],
      checks: [
        { id: "c1", question: "What happened?" },
        { id: "c2", question: "Who was affected?" },
      ],
      // Evidence "staff on floor 3" lives in IMPACT — only that section
      // should be regenerated.
      draftSections: {
        summary:
          "At 14:32 a smoke event triggered evacuation and the building was cleared.",
        timeline:
          "14:32 alarm; 14:44 evacuation; 14:55 fire department arrives; " +
          "15:45 operations resume.",
        impact: "Some staff on floor 3 were evacuated.",
      },
    }));

    const res = await autofixPOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({ documentId: doc.id, mode: "questions" }),
      })
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      regeneratedSectionIds: string[];
      lockedSkipped: string[];
      draftSections: Record<string, string>;
    };
    expect(data.regeneratedSectionIds).toEqual(["impact"]);
    expect(data.lockedSkipped).toEqual([]);

    const persisted = store.get(doc.id)!;
    expect(persisted.draftSections.impact).toBe("Regenerated text for Impact.");
    // Sibling sections are bit-identical with seed.
    expect(persisted.draftSections.summary).toBe(
      "At 14:32 a smoke event triggered evacuation and the building was cleared."
    );
    expect(persisted.draftSections.timeline).toMatch(/14:32 alarm/);
  });

  it("falls back to structurally-failing sections for `missing` checks (no evidence)", async () => {
    setDefaultProviderForTesting(
      combinedProvider({
        questionMap: {
          "What follow-up is open?": {
            status: "missing",
            suggestion: "Insert unresolved action items and owners.",
          },
        },
      })
    );
    const store = getDefaultStore();
    const created = store.create();
    const doc = store.update(created.id, (d) => ({
      ...d,
      outline: [SUMMARY, IMPACT],
      checks: [{ id: "c1", question: "What follow-up is open?" }],
      // SUMMARY has substantive content; IMPACT is empty → structurally
      // missing.
      draftSections: {
        summary:
          "Plenty of substantive content here that runs more than twenty-five " +
          "words so that the structural evaluator marks it as present rather " +
          "than thin and the autofix flow does not consider it a target.",
        // impact is missing entirely.
      },
    }));

    const res = await autofixPOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({ documentId: doc.id, mode: "questions" }),
      })
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { regeneratedSectionIds: string[] };
    expect(data.regeneratedSectionIds).toEqual(["impact"]);

    const persisted = store.get(doc.id)!;
    expect(persisted.draftSections.impact).toBe(
      "Regenerated text for Impact."
    );
    // The substantive Summary text is bit-identical (not regenerated).
    expect(persisted.draftSections.summary).toMatch(/Plenty of substantive/);
  });

  it("skips locked sections and reports them in lockedSkipped", async () => {
    setDefaultProviderForTesting(
      combinedProvider({
        questionMap: {
          "Who was affected?": {
            status: "partial",
            evidence: "staff on floor 3",
            suggestion: "Add exact roles.",
          },
        },
      })
    );
    const store = getDefaultStore();
    const created = store.create();
    const doc = store.update(created.id, (d) => ({
      ...d,
      outline: [SUMMARY, IMPACT],
      checks: [{ id: "c1", question: "Who was affected?" }],
      draftSections: {
        summary: "An incident occurred and was resolved.",
        impact: "Some staff on floor 3 were evacuated.",
      },
      lockedSectionIds: ["impact"],
    }));

    const res = await autofixPOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({ documentId: doc.id, mode: "questions" }),
      })
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      regeneratedSectionIds: string[];
      lockedSkipped: string[];
    };
    expect(data.regeneratedSectionIds).toEqual([]);
    expect(data.lockedSkipped).toEqual(["impact"]);

    // Locked section is bit-identical.
    const persisted = store.get(doc.id)!;
    expect(persisted.draftSections.impact).toBe(
      "Some staff on floor 3 were evacuated."
    );
  });

  it("returns no targets and 200 when all checks are answered", async () => {
    setDefaultProviderForTesting(
      combinedProvider({
        questionMap: {
          "What happened?": {
            status: "answered",
            evidence: "smoke event triggered evacuation",
            suggestion: null,
          },
        },
      })
    );
    const store = getDefaultStore();
    const created = store.create();
    const doc = store.update(created.id, (d) => ({
      ...d,
      outline: [SUMMARY],
      checks: [{ id: "c1", question: "What happened?" }],
      draftSections: {
        summary:
          "A smoke event triggered evacuation; the building was cleared in twelve minutes and operations resumed at fifteen forty-five.",
      },
    }));

    const res = await autofixPOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({ documentId: doc.id, mode: "questions" }),
      })
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      regeneratedSectionIds: string[];
    };
    expect(data.regeneratedSectionIds).toEqual([]);

    const persisted = store.get(doc.id)!;
    // Bit-identical.
    expect(persisted.draftSections.summary).toMatch(/twelve minutes/);
  });
});

describe("POST /api/autofix — structure mode (Regenerate failed sections)", () => {
  beforeEach(() => {
    setDefaultStoreForTesting(
      createDocumentStore({ filename: ":memory:" })
    );
    setDefaultProviderForTesting(combinedProvider({ questionMap: {} }));
  });

  afterEach(() => {
    setDefaultStoreForTesting(null);
    setDefaultProviderForTesting(null);
  });

  it("regenerates only sections marked missing or thin; present sections are untouched", async () => {
    const store = getDefaultStore();
    const created = store.create();
    const doc = store.update(created.id, (d) => ({
      ...d,
      outline: [SUMMARY, TIMELINE, IMPACT],
      checks: [],
      draftSections: {
        // present (long enough)
        summary:
          "An extensive summary that runs well past twenty-five words so the " +
          "structural evaluator considers it present rather than thin, with " +
          "enough content that the autofix flow does not treat it as a target.",
        // thin (under 25 words)
        timeline: "It was a busy day.",
        // missing entirely
      },
    }));

    const res = await autofixPOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({ documentId: doc.id, mode: "structure" }),
      })
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { regeneratedSectionIds: string[] };
    expect(data.regeneratedSectionIds.sort()).toEqual(["impact", "timeline"]);

    const persisted = store.get(doc.id)!;
    // Bit-identical for present.
    expect(persisted.draftSections.summary).toMatch(/extensive summary/);
    // Regenerated for thin + missing.
    expect(persisted.draftSections.timeline).toBe(
      "Regenerated text for Timeline."
    );
    expect(persisted.draftSections.impact).toBe(
      "Regenerated text for Impact."
    );
  });

  it("skips locked sections in structure mode and reports them in lockedSkipped", async () => {
    const store = getDefaultStore();
    const created = store.create();
    const doc = store.update(created.id, (d) => ({
      ...d,
      outline: [SUMMARY, TIMELINE, IMPACT],
      checks: [],
      draftSections: {
        summary:
          "An extensive summary that runs well past twenty-five words so the " +
          "structural evaluator considers it present rather than thin, with " +
          "enough content that the autofix flow does not treat it as a target.",
        timeline: "Brief timeline.",
        // impact missing
      },
      lockedSectionIds: ["timeline"],
    }));

    const res = await autofixPOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({ documentId: doc.id, mode: "structure" }),
      })
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      regeneratedSectionIds: string[];
      lockedSkipped: string[];
    };
    expect(data.regeneratedSectionIds).toEqual(["impact"]);
    expect(data.lockedSkipped).toEqual(["timeline"]);

    const persisted = store.get(doc.id)!;
    // Locked thin section stays bit-identical despite being structurally weak.
    expect(persisted.draftSections.timeline).toBe("Brief timeline.");
    expect(persisted.draftSections.impact).toBe(
      "Regenerated text for Impact."
    );
  });

  it("returns no targets when all sections are present", async () => {
    const store = getDefaultStore();
    const created = store.create();
    const doc = store.update(created.id, (d) => ({
      ...d,
      outline: [SUMMARY],
      checks: [],
      draftSections: {
        summary:
          "An extensive summary that runs well past twenty-five words so the " +
          "structural evaluator considers it present rather than thin, with " +
          "enough content that the autofix flow does not treat it as a target.",
      },
    }));

    const res = await autofixPOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({ documentId: doc.id, mode: "structure" }),
      })
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { regeneratedSectionIds: string[] };
    expect(data.regeneratedSectionIds).toEqual([]);
  });
});

describe("POST /api/autofix — invariants and validation", () => {
  beforeEach(() => {
    setDefaultStoreForTesting(
      createDocumentStore({ filename: ":memory:" })
    );
    setDefaultProviderForTesting(combinedProvider({ questionMap: {} }));
  });

  afterEach(() => {
    setDefaultStoreForTesting(null);
    setDefaultProviderForTesting(null);
  });

  it("does not modify spec, outline, or checks (PRD user story 40)", async () => {
    const store = getDefaultStore();
    const created = store.create();
    const before = store.update(created.id, (d) => ({
      ...d,
      spec: { ...d.spec, goal: "Document the outage." },
      outline: [SUMMARY, TIMELINE],
      checks: [{ id: "c1", question: "What happened?" }],
      draftSections: { summary: "Brief.", timeline: "Brief." },
    }));

    await autofixPOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({ documentId: before.id, mode: "structure" }),
      })
    );

    const after = store.get(before.id)!;
    expect(after.spec).toEqual(before.spec);
    expect(after.outline).toEqual(before.outline);
    expect(after.checks).toEqual(before.checks);
  });

  it("404s on unknown document id", async () => {
    const res = await autofixPOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({ documentId: "nope", mode: "structure" }),
      })
    );
    expect(res.status).toBe(404);
  });

  it("400s when mode is invalid", async () => {
    const store = getDefaultStore();
    const created = store.create();
    const res = await autofixPOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({ documentId: created.id, mode: "delete" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("400s when documentId is missing", async () => {
    const res = await autofixPOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({ mode: "structure" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("400s on invalid JSON body", async () => {
    const res = await autofixPOST(
      new Request("http://t/", { method: "POST", body: "not json" })
    );
    expect(res.status).toBe(400);
  });
});
