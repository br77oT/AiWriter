import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createDocumentStore,
  setDefaultStoreForTesting,
} from "@/lib/document-store";
import {
  createScriptedProvider,
  setDefaultProviderForTesting,
} from "@/lib/llm";
import { POST as validatePOST } from "./route";

describe("POST /api/validate", () => {
  beforeEach(() => {
    setDefaultStoreForTesting(createDocumentStore({ filename: ":memory:" }));
    setDefaultProviderForTesting(
      createScriptedProvider(() =>
        JSON.stringify({
          status: "answered",
          evidence: "Pipe burst at 03:15.",
          suggestion: null,
        })
      )
    );
  });

  afterEach(() => {
    setDefaultStoreForTesting(null);
    setDefaultProviderForTesting(null);
  });

  it("returns a ValidationReport for a stored document", async () => {
    const store = (await import("@/lib/document-store")).getDefaultStore();
    const created = store.create();
    store.update(created.id, (doc) => ({
      ...doc,
      outline: [
        { id: "summary", heading: "Summary", description: "", required: true },
      ],
      checks: [{ id: "c1", question: "What happened?" }],
      draftSections: { summary: "Pipe burst at 03:15 in the basement." },
    }));

    const res = await validatePOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({ documentId: created.id }),
      })
    );
    expect(res.status).toBe(200);
    const { report } = await res.json();
    expect(report.structure).toHaveLength(1);
    expect(report.structure[0].outlineId).toBe("summary");
    expect(report.questions).toHaveLength(1);
    expect(report.questions[0].status).toBe("answered");
    expect(report.coverageScore).toMatchObject({
      checksAnswered: 1,
      checksTotal: 1,
    });
  });

  it("404s on unknown document id", async () => {
    const res = await validatePOST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({ documentId: "no-such-id" }),
      })
    );
    expect(res.status).toBe(404);
  });

  it("400s when documentId is missing", async () => {
    const res = await validatePOST(
      new Request("http://t/", { method: "POST", body: "{}" })
    );
    expect(res.status).toBe(400);
  });
});
