// Export deep module — PRD user story 33 (Markdown / plain text /
// copy-to-clipboard) and user story 12 (block export if any check is missing).
//
// Pure functions only: turn a document's outline + draft into the chosen
// output format, decide whether export is blocked given the latest validation
// report. Side effects (downloading, writing the clipboard) live in the UI
// layer where the browser APIs are.

import type {
  Check,
  ChecksConfig,
  OutlineSection,
  QuestionStatus,
  ValidationReport,
} from "../types";

export interface ExportDocument {
  title: string;
  outline: OutlineSection[];
  draftSections: Record<string, string>;
}

export interface BlockingFailure {
  checkId: string;
  question: string;
  status: QuestionStatus;
}

// Markdown export: outline order, top-level sections rendered as `# Heading`,
// children (parentId set) as `## Heading`. Sections with empty / whitespace-only
// drafts are skipped per the issue's "empty sections are skipped" rule.
export function exportMarkdown(doc: ExportDocument): string {
  const parts: string[] = [];
  for (const section of doc.outline) {
    const body = doc.draftSections[section.id];
    if (!body || body.trim() === "") continue;
    const level = section.parentId ? 2 : 1;
    parts.push(`${"#".repeat(level)} ${section.heading}\n\n${body}\n`);
  }
  return parts.join("\n");
}

// Plain text: same content as Markdown, with markdown syntax stripped. The
// output is intentionally lossy — links lose their URL, code blocks lose their
// fences, quotes lose their `>`. The user gets a human-readable transcript.
export function exportPlainText(doc: ExportDocument): string {
  const parts: string[] = [];
  for (const section of doc.outline) {
    const body = doc.draftSections[section.id];
    if (!body || body.trim() === "") continue;
    parts.push(`${section.heading}\n\n${stripMarkdown(body)}\n`);
  }
  return parts.join("\n");
}

// Returns the list of failing checks if export is blocked; null otherwise.
// "Blocked" means `blockExportIfMissing` is ON AND at least one check is
// missing or partial in the latest report. Without a report, returns null —
// the UI is expected to run validation first before opening the popover.
export function getBlockingFailures(
  checks: Check[],
  config: ChecksConfig,
  report: ValidationReport | null
): BlockingFailure[] | null {
  if (!config.blockExportIfMissing) return null;
  if (!report) return null;
  const failing = report.questions.filter(
    (q) => q.status === "missing" || q.status === "partial"
  );
  if (failing.length === 0) return null;
  const byId = new Map(checks.map((c) => [c.id, c.question] as const));
  return failing.map((q) => ({
    checkId: q.checkId,
    question: byId.get(q.checkId) ?? q.checkId,
    status: q.status,
  }));
}

export function suggestFilename(title: string, ext: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const base = slug || "document";
  return `${base}.${ext}`;
}

// Cheap markdown stripper sufficient for prose drafts produced by the
// generation engine. Not a full CommonMark parser — we only target the syntax
// the engine is likely to emit (headings, bold/italic, code, blockquote,
// code fences, links, strikethrough). Bullet/numbered list markers are kept;
// they read fine in plain text.
function stripMarkdown(input: string): string {
  let out = input;
  // Drop fenced code blocks but preserve the inner content.
  out = out.replace(/```[a-zA-Z0-9_-]*\n?([\s\S]*?)```/g, "$1");
  // Strip leading heading hashes ("## foo" → "foo").
  out = out.replace(/^#{1,6}\s+/gm, "");
  // Strip leading blockquote markers ("> foo" → "foo").
  out = out.replace(/^>\s?/gm, "");
  // Inline code: `foo` → foo.
  out = out.replace(/`([^`]+)`/g, "$1");
  // Bold: **foo** or __foo__ → foo. Keep this BEFORE italic so the inner
  // single-marker pattern doesn't claim half a bold pair.
  out = out.replace(/\*\*(.+?)\*\*/g, "$1");
  out = out.replace(/__(.+?)__/g, "$1");
  // Italic: *foo* or _foo_ → foo. Avoid matching list bullets at line-start.
  out = out.replace(/(^|[^\*\w])\*(?!\s)([^\*\n]+?)\*/g, "$1$2");
  out = out.replace(/(^|[^_\w])_(?!\s)([^_\n]+?)_/g, "$1$2");
  // Strikethrough.
  out = out.replace(/~~(.+?)~~/g, "$1");
  // Links: [text](url) → text.
  out = out.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  return out;
}
