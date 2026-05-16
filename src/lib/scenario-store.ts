import Database from "better-sqlite3";
import { randomBytes } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import type {
  Check,
  ChecksConfig,
  Document,
  OutlineSection,
  Spec,
} from "./types";

// A scenario is a frozen copy of a document's *authored* content — everything
// except per-instance history. Opening a scenario link mints a fresh document
// from this snapshot, so the link is reusable and never mutated by viewers.
export interface ScenarioSnapshot {
  title: string;
  spec: Spec;
  outline: OutlineSection[];
  checks: Check[];
  checksConfig: ChecksConfig;
  draftSections: Record<string, string>;
  lockedSectionIds: string[];
  outlineFrozen: boolean;
  templateId: string | null;
}

export function snapshotFromDocument(doc: Document): ScenarioSnapshot {
  return {
    title: doc.title,
    spec: doc.spec,
    outline: doc.outline,
    checks: doc.checks,
    checksConfig: doc.checksConfig,
    draftSections: doc.draftSections,
    lockedSectionIds: doc.lockedSectionIds,
    outlineFrozen: doc.outlineFrozen,
    templateId: doc.templateId,
  };
}

// Overlays a snapshot onto a freshly-created document, preserving the new
// document's identity fields (id / createdAt / updatedAt / versions).
export function applySnapshotToDocument(
  doc: Document,
  snapshot: ScenarioSnapshot
): Document {
  return {
    ...doc,
    title: snapshot.title,
    spec: snapshot.spec,
    outline: snapshot.outline,
    checks: snapshot.checks,
    checksConfig: snapshot.checksConfig,
    draftSections: snapshot.draftSections,
    lockedSectionIds: snapshot.lockedSectionIds,
    outlineFrozen: snapshot.outlineFrozen,
    templateId: snapshot.templateId,
  };
}

// Lightweight row for the scenarios gallery — enough to identify a scenario
// without shipping the whole snapshot.
export interface ScenarioSummary {
  code: string;
  title: string;
  sectionCount: number;
  checkCount: number;
  createdAt: string;
}

export interface ScenarioStore {
  create(snapshot: ScenarioSnapshot, opts?: { now?: string }): { code: string };
  get(code: string): ScenarioSnapshot | null;
  list(): ScenarioSummary[];
}

interface StoreOptions {
  filename: string;
}

// Unambiguous alphabet — no 0/O/1/l/I — so codes survive being read aloud or
// copied by hand. 32 symbols ^ 8 chars ≈ 1.1e12 keyspace.
const CODE_ALPHABET = "23456789abcdefghijkmnpqrstuvwxyz";
const CODE_LENGTH = 8;

function makeCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return code;
}

// Scenario snapshots persist as a single JSON blob per row — same pattern as
// the document and template stores (docs/decisions.md §"Persistence").
export function createScenarioStore(options: StoreOptions): ScenarioStore {
  const db = new Database(options.filename);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS scenarios (
      code TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  const insertStmt = db.prepare(
    "INSERT INTO scenarios (code, data, created_at) VALUES (?, ?, ?)"
  );
  const selectStmt = db.prepare("SELECT data FROM scenarios WHERE code = ?");
  const listStmt = db.prepare(
    "SELECT code, data, created_at FROM scenarios ORDER BY created_at DESC"
  );

  return {
    create(snapshot, opts) {
      const now = opts?.now ?? new Date().toISOString();
      const data = JSON.stringify(snapshot);
      // Retry on the (astronomically unlikely) primary-key collision.
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = makeCode();
        try {
          insertStmt.run(code, data, now);
          return { code };
        } catch (err) {
          const isCollision =
            err instanceof Error &&
            "code" in err &&
            (err as { code?: string }).code === "SQLITE_CONSTRAINT_PRIMARYKEY";
          if (!isCollision) throw err;
        }
      }
      throw new Error("Could not allocate a unique scenario code.");
    },

    get(code) {
      const row = selectStmt.get(code) as { data: string } | undefined;
      if (!row) return null;
      return JSON.parse(row.data) as ScenarioSnapshot;
    },

    list() {
      const rows = listStmt.all() as Array<{
        code: string;
        data: string;
        created_at: string;
      }>;
      return rows.map((row) => {
        const snapshot = JSON.parse(row.data) as ScenarioSnapshot;
        return {
          code: row.code,
          title: snapshot.title,
          sectionCount: snapshot.outline.length,
          checkCount: snapshot.checks.length,
          createdAt: row.created_at,
        };
      });
    },
  };
}

// Process-singleton store backed by the shared on-disk database.
let _defaultStore: ScenarioStore | null = null;

export function getDefaultScenarioStore(): ScenarioStore {
  if (_defaultStore) return _defaultStore;
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  _defaultStore = createScenarioStore({
    filename: path.join(dataDir, "aiwriter.db"),
  });
  return _defaultStore;
}

// Test seam — mirrors the document/template stores.
export function setDefaultScenarioStoreForTesting(
  store: ScenarioStore | null
): void {
  _defaultStore = store;
}
