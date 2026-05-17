// CLI: run document validation from the terminal.
//
//   npm run validate -- <fixtureId | documentId>
//
// Loads .env.local, then runs the full Validation Engine (the structural
// evaluator + the LLM-backed Question Evaluator) and prints the report.
// Refuses to run without ANTHROPIC_API_KEY so you don't burn time on a report
// where every check comes back "error".

import fs from "node:fs";
import path from "node:path";
import { validate } from "../src/lib/validation";
import { FIXTURES, getFixture } from "../src/lib/validation/fixtures";
import { getDefaultStore } from "../src/lib/document-store";
import type { Check, OutlineSection } from "../src/lib/types";

// Standalone scripts don't get Next.js's automatic .env loading, so do a
// minimal version here: KEY=VALUE lines, '#' comments, optional quotes.
// Precedence mirrors Next.js — real environment > .env.local > .env. Files
// are read .env.local first, and a key is only set if still unset, so the
// real environment and earlier files win.
function loadEnvFiles(): void {
  for (const name of [".env.local", ".env"]) {
    const file = path.join(process.cwd(), name);
    if (!fs.existsSync(file)) continue;
    for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  }
}

const STRUCT_GLYPH: Record<string, string> = {
  present: "✓",
  thin: "~",
  missing: "✗",
};
const QUESTION_GLYPH: Record<string, string> = {
  answered: "✓",
  partial: "~",
  missing: "✗",
  error: "⚠",
};

async function main(): Promise<void> {
  loadEnvFiles();

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      [
        "✗ ANTHROPIC_API_KEY is not set — refusing to run.",
        "",
        "Real check evaluation needs an Anthropic API key. Add it to",
        ".env.local in the project root:",
        "",
        "    ANTHROPIC_API_KEY=sk-ant-...",
        "",
        "or pass it inline:",
        "",
        "    ANTHROPIC_API_KEY=sk-ant-... npm run validate -- <target>",
      ].join("\n")
    );
    process.exit(1);
  }

  if (process.env.ANTHROPIC_API_KEY.startsWith("sk-ant-oat")) {
    console.warn(
      "⚠ ANTHROPIC_API_KEY looks like an OAuth / Claude-subscription token\n" +
        "  (sk-ant-oat…), not an API key. The provider authenticates with the\n" +
        "  x-api-key header, so check evaluation will almost certainly 401.\n" +
        "  Use an sk-ant-api03-… key for real results.\n"
    );
  }

  const target = process.argv[2];
  if (!target) {
    console.error(
      "Usage: npm run validate -- <fixtureId | documentId>\n\n" +
        "Fixtures: " +
        FIXTURES.map((f) => f.id).join(", ")
    );
    process.exit(1);
  }

  // Resolve the target: a built-in fixture first, then a saved document.
  let label: string;
  let outline: OutlineSection[];
  let checks: Check[];
  let draft: Record<string, string>;

  const fixture = getFixture(target);
  if (fixture) {
    label = `fixture "${fixture.label}"`;
    outline = fixture.outline;
    checks = fixture.checks;
    draft = fixture.draftSections;
  } else {
    const doc = getDefaultStore().get(target);
    if (!doc) {
      console.error(
        `Not found: "${target}" is neither a fixture id nor a document id.\n` +
          "Fixtures: " +
          FIXTURES.map((f) => f.id).join(", ")
      );
      process.exit(1);
    }
    label = `document "${doc.title}" (${doc.id})`;
    outline = doc.outline;
    checks = doc.checks;
    draft = doc.draftSections;
  }

  console.log(`Validating ${label}`);
  console.log(`Sections: ${outline.length} · Checks: ${checks.length}\n`);

  const report = await validate(draft, outline, checks);

  const headingOf = (id: string) =>
    outline.find((s) => s.id === id)?.heading ?? id;
  const questionOf = (id: string) =>
    checks.find((c) => c.id === id)?.question ?? id;

  console.log("Structure");
  if (report.structure.length === 0) console.log("  (no outline sections)");
  for (const s of report.structure) {
    const note = s.note ? `  — ${s.note}` : "";
    console.log(
      `  ${STRUCT_GLYPH[s.status] ?? "?"} ${headingOf(s.outlineId)}${note}`
    );
  }

  console.log("\nDocument Checks");
  if (report.questions.length === 0) console.log("  (no checks)");
  for (const q of report.questions) {
    console.log(
      `  ${QUESTION_GLYPH[q.status] ?? "?"} [${q.status}] ${questionOf(q.checkId)}`
    );
    if (q.evidence) console.log(`      evidence:   ${q.evidence}`);
    if (q.suggestion) console.log(`      suggestion: ${q.suggestion}`);
  }

  const c = report.coverageScore;
  console.log(
    `\nCoverage: ${c.checksAnswered}/${c.checksTotal} checks answered · ` +
      `${c.sectionsPresent}/${c.sectionsTotal} required sections present`
  );

  // If every check errored the evaluator itself failed (e.g. an invalid key).
  // Exit non-zero so a script/CI run doesn't mistake it for a clean pass.
  const errored = report.questions.filter((q) => q.status === "error").length;
  if (errored > 0 && errored === report.questions.length) {
    console.error(
      `\n✗ All ${errored} check(s) errored — the evaluator did not respond. ` +
        "Check that ANTHROPIC_API_KEY is valid."
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("validate: unexpected error\n", err);
  process.exit(1);
});
