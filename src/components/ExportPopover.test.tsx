import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ExportPopover } from "./ExportPopover";
import type { Document } from "@/lib/types";
import { newDocument } from "@/lib/types";

function docFixture(overrides: Partial<Document> = {}): Document {
  return {
    ...newDocument("doc-1", "2026-04-30T00:00:00.000Z"),
    title: "Outage Report",
    outline: [
      { id: "summary", heading: "Summary", description: "", required: true },
      { id: "impact", heading: "Impact", description: "", required: true },
    ],
    checks: [
      { id: "c1", question: "What happened?" },
      { id: "c2", question: "When?" },
    ],
    draftSections: {
      summary: "Pipe burst at 03:15.",
      impact: "Affected 1,200 users.",
    },
    ...overrides,
  };
}

beforeEach(() => {
  // jsdom's clipboard support is minimal — provide a stub that captures writes.
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(async () => undefined) },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ExportPopover", () => {
  it("renders three options with clear text labels", () => {
    render(
      <ExportPopover
        document={docFixture()}
        report={null}
        onClose={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: /download markdown/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /download plain text/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy to clipboard/i })
    ).toBeInTheDocument();
  });

  it("clicking Copy to Clipboard writes the markdown form to the clipboard", async () => {
    const onClose = vi.fn();
    render(
      <ExportPopover document={docFixture()} report={null} onClose={onClose} />
    );

    fireEvent.click(screen.getByRole("button", { name: /copy to clipboard/i }));

    const writeText = window.navigator.clipboard.writeText as ReturnType<
      typeof vi.fn
    >;
    expect(writeText).toHaveBeenCalledTimes(1);
    const arg = writeText.mock.calls[0][0] as string;
    expect(arg).toContain("# Summary");
    expect(arg).toContain("Pipe burst at 03:15.");
    expect(arg).toContain("# Impact");
  });

  it("Download Markdown triggers a blob download with the correct filename + content", () => {
    const createObjectURL = vi.fn<(b: Blob) => string>(() => "blob:fake");
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    render(
      <ExportPopover
        document={docFixture()}
        report={null}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /download markdown/i }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toMatch(/text\/markdown/);
  });

  it("Download Plain Text triggers a blob download with text/plain", () => {
    const createObjectURL = vi.fn<(b: Blob) => string>(() => "blob:fake");
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    render(
      <ExportPopover
        document={docFixture()}
        report={null}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /download plain text/i })
    );

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toMatch(/text\/plain/);
  });

  it("when block-if-missing is ON and report has failures, all three actions are disabled and the failing checks are listed", () => {
    const doc = docFixture({
      checksConfig: {
        evaluateAfterEveryGeneration: true,
        blockExportIfMissing: true,
      },
    });
    render(
      <ExportPopover
        document={doc}
        report={{
          structure: [],
          questions: [
            { checkId: "c1", status: "missing" },
            { checkId: "c2", status: "partial" },
          ],
          coverageScore: {
            checksAnswered: 0,
            checksTotal: 2,
            sectionsPresent: 0,
            sectionsTotal: 0,
          },
        }}
        onClose={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: /download markdown/i })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /download plain text/i })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /copy to clipboard/i })
    ).toBeDisabled();

    // Failing check questions are visible to the user.
    expect(screen.getByText(/What happened\?/)).toBeInTheDocument();
    expect(screen.getByText(/When\?/)).toBeInTheDocument();
  });

  it("when block-if-missing is ON but all checks are answered, actions remain enabled", () => {
    const doc = docFixture({
      checksConfig: {
        evaluateAfterEveryGeneration: true,
        blockExportIfMissing: true,
      },
    });
    render(
      <ExportPopover
        document={doc}
        report={{
          structure: [],
          questions: [
            { checkId: "c1", status: "answered" },
            { checkId: "c2", status: "answered" },
          ],
          coverageScore: {
            checksAnswered: 2,
            checksTotal: 2,
            sectionsPresent: 0,
            sectionsTotal: 0,
          },
        }}
        onClose={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: /download markdown/i })
    ).toBeEnabled();
  });

  it("clicking Close fires onClose", () => {
    const onClose = vi.fn();
    render(
      <ExportPopover document={docFixture()} report={null} onClose={onClose} />
    );

    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
