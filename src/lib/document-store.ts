import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import {
  type Document,
  type DocumentSummary,
  newDocument,
} from "./types";

export interface DocumentStore {
  create(opts?: { now?: string }): Document;
  get(id: string): Document | null;
  list(): DocumentSummary[];
  update(id: string, mutate: (doc: Document) => Document): Document;
}

interface StoreOptions {
  filename: string;
}

// Documents are persisted as a single JSON blob per row. The structured fields
// (spec, outline[], checks[], draftSections{}, etc.) round-trip through
// JSON.stringify/parse. See docs/decisions.md §"Persistence" for why this is
// fine for V1 — revisit when a slice needs to query *into* the JSON.
export function createDocumentStore(options: StoreOptions): DocumentStore {
  const db = new Database(options.filename);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_documents_updated_at
      ON documents(updated_at DESC);
  `);

  const insertStmt = db.prepare(
    "INSERT INTO documents (id, data, updated_at) VALUES (?, ?, ?)"
  );
  const selectStmt = db.prepare(
    "SELECT data FROM documents WHERE id = ?"
  );
  const listStmt = db.prepare(
    "SELECT id, data, updated_at FROM documents ORDER BY updated_at DESC"
  );
  const updateStmt = db.prepare(
    "UPDATE documents SET data = ?, updated_at = ? WHERE id = ?"
  );

  return {
    create(opts) {
      const now = opts?.now ?? new Date().toISOString();
      const doc = newDocument(randomUUID(), now);
      insertStmt.run(doc.id, JSON.stringify(doc), doc.updatedAt);
      return doc;
    },

    get(id) {
      const row = selectStmt.get(id) as { data: string } | undefined;
      if (!row) return null;
      return JSON.parse(row.data) as Document;
    },

    list() {
      const rows = listStmt.all() as Array<{
        id: string;
        data: string;
        updated_at: string;
      }>;
      return rows.map((row) => {
        const doc = JSON.parse(row.data) as Document;
        return {
          id: doc.id,
          title: doc.title,
          updatedAt: doc.updatedAt,
        };
      });
    },

    update(id, mutate) {
      const existing = this.get(id);
      if (!existing) {
        throw new Error(`Document not found: ${id}`);
      }
      const nowMs = Date.now();
      const minMs = Date.parse(existing.updatedAt) + 1;
      const updatedAt = new Date(Math.max(nowMs, minMs)).toISOString();
      const next: Document = {
        ...mutate(existing),
        id: existing.id, // id is immutable
        createdAt: existing.createdAt,
        updatedAt,
      };
      updateStmt.run(JSON.stringify(next), next.updatedAt, id);
      return next;
    },
  };
}

// Process-singleton store backed by a file on disk. Used by API route handlers.
let _defaultStore: DocumentStore | null = null;

export function getDefaultStore(): DocumentStore {
  if (_defaultStore) return _defaultStore;
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  _defaultStore = createDocumentStore({
    filename: path.join(dataDir, "aiwriter.db"),
  });
  return _defaultStore;
}

// Test seam — lets API smoke tests swap in an in-memory store.
export function setDefaultStoreForTesting(store: DocumentStore | null): void {
  _defaultStore = store;
}
