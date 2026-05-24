import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createDocumentStore,
  setDefaultStoreForTesting,
} from "@/lib/document-store";
import { GET as listGET, POST as createPOST } from "./route";
import {
  GET as getOneGET,
  PUT as updatePUT,
  DELETE as deleteDELETE,
} from "./[id]/route";

describe("/api/documents route handlers", () => {
  beforeEach(() => {
    setDefaultStoreForTesting(
      createDocumentStore({ filename: ":memory:" })
    );
  });

  afterEach(() => {
    setDefaultStoreForTesting(null);
  });

  it("POST creates a document and GET lists it", async () => {
    const created = await createPOST();
    expect(created.status).toBe(201);
    const { document } = await created.json();
    expect(document.id).toMatch(/.+/);
    expect(document.title).toBe("Untitled document");

    const listed = await listGET();
    const { documents } = await listed.json();
    expect(documents).toHaveLength(1);
    expect(documents[0].id).toBe(document.id);
  });

  it("GET /[id] returns the document, 404s on unknown id", async () => {
    const created = await createPOST();
    const { document } = await created.json();

    const found = await getOneGET(new Request("http://t/"), {
      params: Promise.resolve({ id: document.id }),
    });
    expect(found.status).toBe(200);
    const fetched = await found.json();
    expect(fetched.document.id).toBe(document.id);

    const missing = await getOneGET(new Request("http://t/"), {
      params: Promise.resolve({ id: "no-such-id" }),
    });
    expect(missing.status).toBe(404);
  });

  it("DELETE /[id] removes the document; 404 on unknown id", async () => {
    const created = await createPOST();
    const { document } = await created.json();

    const ok = await deleteDELETE(new Request("http://t/", { method: "DELETE" }), {
      params: Promise.resolve({ id: document.id }),
    });
    expect(ok.status).toBe(200);

    const missing = await getOneGET(new Request("http://t/"), {
      params: Promise.resolve({ id: document.id }),
    });
    expect(missing.status).toBe(404);

    const repeat = await deleteDELETE(
      new Request("http://t/", { method: "DELETE" }),
      { params: Promise.resolve({ id: document.id }) }
    );
    expect(repeat.status).toBe(404);
  });

  it("PUT /[id] updates the document", async () => {
    const created = await createPOST();
    const { document } = await created.json();

    const res = await updatePUT(
      new Request("http://t/", {
        method: "PUT",
        body: JSON.stringify({
          document: { title: "Renamed" },
        }),
      }),
      { params: Promise.resolve({ id: document.id }) }
    );
    expect(res.status).toBe(200);
    const { document: updated } = await res.json();
    expect(updated.title).toBe("Renamed");
    expect(updated.id).toBe(document.id);
  });
});
