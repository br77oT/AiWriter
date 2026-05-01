import { describe, it, expect } from "vitest";
import {
  exportMarkdown,
  exportPlainText,
  getBlockingFailures,
  suggestFilename,
  type ExportDocument,
} from "./index";
import type { Check, ChecksConfig, ValidationReport } from "../types";

function fixture(partial: Partial<ExportDocument> = {}): ExportDocument {
  return {
    title: "Untitled document",
    outline: [
      { id: "summary", heading: "Summary", description: "", required: true },
      { id: "impact", heading: "Impact", description: "", required: true },
    ],
    draftSections: {
      summary: "Pipe burst at 03:15.",
      impact: "Affected 1,200 users.",
    },
    ...partial,
  };
}

describe("exportMarkdown", () => {
  it("renders top-level outline headings as `#` followed by section body", () => {
    const md = exportMarkdown(fixture());
    expect(md).toBe(
      "# Summary\n\nPipe burst at 03:15.\n\n# Impact\n\nAffected 1,200 users.\n"
    );
  });

  it("preserves outline order even when draftSections key order differs", () => {
    const md = exportMarkdown(
      fixture({
        draftSections: {
          impact: "I",
          summary: "S",
        },
      })
    );
    // Summary comes first because outline order is summary → impact.
    expect(md.indexOf("# Summary")).toBeLessThan(md.indexOf("# Impact"));
  });

  it("skips sections whose draft is missing or whitespace-only", () => {
    const md = exportMarkdown(
      fixture({
        outline: [
          { id: "summary", heading: "Summary", description: "", required: true },
          { id: "blank", heading: "Blank", description: "", required: false },
          { id: "ws", heading: "Whitespace", description: "", required: false },
          { id: "impact", heading: "Impact", description: "", required: true },
        ],
        draftSections: {
          summary: "Pipe burst at 03:15.",
          ws: "   \n  \t  ",
          impact: "Affected 1,200 users.",
          // blank: not present at all
        },
      })
    );
    expect(md).not.toContain("# Blank");
    expect(md).not.toContain("# Whitespace");
    expect(md).toContain("# Summary");
    expect(md).toContain("# Impact");
  });

  it("nested sections (with parentId) render as `##`", () => {
    const md = exportMarkdown({
      title: "Doc",
      outline: [
        { id: "a", heading: "Top", description: "", required: true },
        { id: "b", heading: "Child", description: "", required: false, parentId: "a" },
      ],
      draftSections: { a: "top body", b: "child body" },
    });
    expect(md).toContain("# Top");
    expect(md).toContain("## Child");
  });

  it("returns an empty string when no section has any draft content", () => {
    const md = exportMarkdown(
      fixture({ draftSections: { summary: "", impact: "" } })
    );
    expect(md).toBe("");
  });
});

describe("exportPlainText", () => {
  it("renders headings as plain lines (no `#`)", () => {
    const txt = exportPlainText(fixture());
    expect(txt).toContain("Summary\n");
    expect(txt).not.toMatch(/^#/m);
  });

  it("strips inline markdown syntax: bold, italic, code, links, strikethrough", () => {
    const txt = exportPlainText({
      title: "Doc",
      outline: [
        { id: "s", heading: "S", description: "", required: true },
      ],
      draftSections: {
        s: "**bold** and *italic* and _emph_ and `code` and [link](http://x) and ~~strike~~",
      },
    });
    expect(txt).toContain("bold");
    expect(txt).toContain("italic");
    expect(txt).toContain("emph");
    expect(txt).toContain("code");
    expect(txt).toContain("link");
    expect(txt).toContain("strike");
    expect(txt).not.toContain("**");
    expect(txt).not.toContain("`");
    expect(txt).not.toContain("~~");
    expect(txt).not.toContain("](http");
  });

  it("strips block-level markdown syntax: headings, blockquotes, code fences", () => {
    const txt = exportPlainText({
      title: "Doc",
      outline: [
        { id: "s", heading: "S", description: "", required: true },
      ],
      draftSections: {
        s: "## Inline heading\n\n> blockquote line\n\n```\ncode block\n```",
      },
    });
    expect(txt).toContain("Inline heading");
    expect(txt).toContain("blockquote line");
    expect(txt).toContain("code block");
    expect(txt).not.toContain("##");
    expect(txt).not.toContain("```");
    expect(txt).not.toMatch(/^>\s/m);
  });

  it("skips empty sections", () => {
    const txt = exportPlainText(
      fixture({
        outline: [
          { id: "s", heading: "S", description: "", required: true },
          { id: "empty", heading: "Empty", description: "", required: false },
        ],
        draftSections: { s: "Body" },
      })
    );
    expect(txt).not.toContain("Empty");
  });
});

describe("getBlockingFailures", () => {
  const checks: Check[] = [
    { id: "c1", question: "What happened?" },
    { id: "c2", question: "When?" },
    { id: "c3", question: "Who?" },
  ];

  function reportFor(
    statuses: Array<["c1" | "c2" | "c3", "answered" | "partial" | "missing"]>
  ): ValidationReport {
    return {
      structure: [],
      questions: statuses.map(([id, status]) => ({ checkId: id, status })),
      coverageScore: {
        checksAnswered: statuses.filter(([, s]) => s === "answered").length,
        checksTotal: statuses.length,
        sectionsPresent: 0,
        sectionsTotal: 0,
      },
    };
  }

  it("returns null when blockExportIfMissing is OFF (regardless of failures)", () => {
    const config: ChecksConfig = {
      evaluateAfterEveryGeneration: false,
      blockExportIfMissing: false,
    };
    const report = reportFor([["c1", "missing"], ["c2", "answered"]]);
    expect(getBlockingFailures(checks, config, report)).toBeNull();
  });

  it("returns null when toggle is ON but all checks are answered", () => {
    const config: ChecksConfig = {
      evaluateAfterEveryGeneration: false,
      blockExportIfMissing: true,
    };
    const report = reportFor([
      ["c1", "answered"],
      ["c2", "answered"],
      ["c3", "answered"],
    ]);
    expect(getBlockingFailures(checks, config, report)).toBeNull();
  });

  it("returns failing checks (with question text) when toggle is ON and any check is missing or partial", () => {
    const config: ChecksConfig = {
      evaluateAfterEveryGeneration: false,
      blockExportIfMissing: true,
    };
    const report = reportFor([
      ["c1", "missing"],
      ["c2", "partial"],
      ["c3", "answered"],
    ]);
    const failures = getBlockingFailures(checks, config, report);
    expect(failures).not.toBeNull();
    expect(failures!.map((f) => f.checkId).sort()).toEqual(["c1", "c2"]);
    const c1 = failures!.find((f) => f.checkId === "c1")!;
    expect(c1.question).toBe("What happened?");
    expect(c1.status).toBe("missing");
  });

  it("returns null when there is no report yet (caller must run validate first)", () => {
    const config: ChecksConfig = {
      evaluateAfterEveryGeneration: false,
      blockExportIfMissing: true,
    };
    expect(getBlockingFailures(checks, config, null)).toBeNull();
  });
});

describe("suggestFilename", () => {
  it("slugifies the title and appends the extension", () => {
    expect(suggestFilename("Outage Report — May", "md")).toBe(
      "outage-report-may.md"
    );
  });

  it("falls back to 'document' when title is blank or untitled", () => {
    expect(suggestFilename("", "txt")).toBe("document.txt");
    expect(suggestFilename("   ", "txt")).toBe("document.txt");
  });
});
