import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createDocumentStore,
  setDefaultStoreForTesting,
  type DocumentStore,
} from "@/lib/document-store";
import {
  createScenarioStore,
  setDefaultScenarioStoreForTesting,
} from "@/lib/scenario-store";
import { POST } from "./route";

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://t/api/scenarios", {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
}

describe("/api/scenarios route", () => {
  let docStore: DocumentStore;

  beforeEach(() => {
    docStore = createDocumentStore({ filename: ":memory:" });
    setDefaultStoreForTesting(docStore);
    setDefaultScenarioStoreForTesting(
      createScenarioStore({ filename: ":memory:" })
    );
  });

  afterEach(() => {
    setDefaultStoreForTesting(null);
    setDefaultScenarioStoreForTesting(null);
  });

  it("POST creates a scenario from an existing document", async () => {
    const doc = docStore.create();
    const res = await post({ documentId: doc.id });
    expect(res.status).toBe(201);
    const { code } = (await res.json()) as { code: string };
    expect(code).toMatch(/^[2-9a-z]{8}$/);
  });

  it("POST 400s when documentId is missing", async () => {
    const res = await post({});
    expect(res.status).toBe(400);
  });

  it("POST 404s when the document does not exist", async () => {
    const res = await post({ documentId: "no-such-document" });
    expect(res.status).toBe(404);
  });
});
