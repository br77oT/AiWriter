import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import {
  BUILT_IN_TEMPLATES,
  getBuiltInTemplate,
  type Template,
  type TemplateBundle,
} from "./templates";

export interface TemplateStore {
  // Returns built-ins followed by user-saved (newest-first within user-saved).
  list(): Template[];
  get(id: string): Template | null;
  saveUser(name: string, bundle: TemplateBundle, opts?: { now?: string }): Template;
}

interface StoreOptions {
  filename: string;
}

// User-saved templates are persisted as a single JSON blob per row, mirroring
// the document-store pattern (docs/decisions.md §"Persistence"). Built-in
// templates are not persisted — they live in code so they always reflect the
// current product set.
export function createTemplateStore(options: StoreOptions): TemplateStore {
  const db = new Database(options.filename);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_templates (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_user_templates_updated_at
      ON user_templates(updated_at DESC);
  `);

  const insertStmt = db.prepare(
    "INSERT INTO user_templates (id, data, updated_at) VALUES (?, ?, ?)"
  );
  const selectStmt = db.prepare(
    "SELECT data FROM user_templates WHERE id = ?"
  );
  const listStmt = db.prepare(
    "SELECT data FROM user_templates ORDER BY updated_at DESC"
  );

  return {
    list() {
      const rows = listStmt.all() as Array<{ data: string }>;
      const userTemplates = rows.map(
        (row) => JSON.parse(row.data) as Template
      );
      return [...BUILT_IN_TEMPLATES, ...userTemplates];
    },

    get(id) {
      const builtIn = getBuiltInTemplate(id);
      if (builtIn) return builtIn;
      const row = selectStmt.get(id) as { data: string } | undefined;
      if (!row) return null;
      return JSON.parse(row.data) as Template;
    },

    saveUser(name, bundle, opts) {
      // Use a "user-" prefix so user IDs cannot collide with built-in slugs
      // (and so the API can disambiguate without a builtIn lookup).
      const id = `user-${randomUUID()}`;
      const now = opts?.now ?? new Date().toISOString();
      const template: Template = {
        id,
        name,
        builtIn: false,
        bundle,
      };
      insertStmt.run(id, JSON.stringify(template), now);
      return template;
    },
  };
}

// Process-singleton store backed by a file on disk. Used by API route handlers.
let _defaultStore: TemplateStore | null = null;

export function getDefaultTemplateStore(): TemplateStore {
  if (_defaultStore) return _defaultStore;
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  _defaultStore = createTemplateStore({
    filename: path.join(dataDir, "aiwriter.db"),
  });
  return _defaultStore;
}

// Test seam — lets API route tests swap in an in-memory store.
export function setDefaultTemplateStoreForTesting(
  store: TemplateStore | null
): void {
  _defaultStore = store;
}
