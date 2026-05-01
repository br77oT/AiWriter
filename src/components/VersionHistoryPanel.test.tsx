import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
} from "@testing-library/react";
import { VersionHistoryPanel } from "./VersionHistoryPanel";
import type { Document, Version } from "@/lib/types";
import { newDocument } from "@/lib/types";

afterEach(cleanup);

function makeVersion(
  id: string,
  label: string,
  timestamp: string,
  draftSections: Record<string, string> = {},
  validationReport: Version["validationReport"] = null
): Version {
  return { id, label, timestamp, draftSections, validationReport };
}

function makeDoc(versions: Version[]): Document {
  return {
    ...newDocument("doc-1", "2026-04-30T00:00:00.000Z"),
    outline: [
      { id: "summary", heading: "Summary", description: "", required: true },
      { id: "impact", heading: "Impact", description: "", required: true },
    ],
    versions,
  };
}

describe("VersionHistoryPanel — list view", () => {
  it("renders versions newest-first with timestamp + label", () => {
    const doc = makeDoc([
      makeVersion("v1", "Generate", "2026-04-30T00:30:00.000Z"),
      makeVersion("v2", "Validate", "2026-04-30T01:00:00.000Z"),
      makeVersion("v3", "Auto-fix: questions", "2026-04-30T00:45:00.000Z"),
    ]);
    render(
      <VersionHistoryPanel
        document={doc}
        onClose={vi.fn()}
        onRestore={vi.fn()}
      />
    );

    const items = screen.getAllByTestId("version-row");
    expect(items.map((el) => el.getAttribute("data-version-id"))).toEqual([
      "v2",
      "v3",
      "v1",
    ]);
    expect(items[0].textContent).toMatch(/Validate/);
  });

  it("renders an empty-state message when no versions exist", () => {
    const doc = makeDoc([]);
    render(
      <VersionHistoryPanel
        document={doc}
        onClose={vi.fn()}
        onRestore={vi.fn()}
      />
    );
    expect(
      screen.getByText(/no version history yet/i)
    ).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", () => {
    const doc = makeDoc([
      makeVersion("v1", "Generate", "2026-04-30T00:30:00.000Z"),
    ]);
    const onClose = vi.fn();
    render(
      <VersionHistoryPanel
        document={doc}
        onClose={onClose}
        onRestore={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("VersionHistoryPanel — view + restore", () => {
  it("clicking View on a row shows that version's draft text read-only", () => {
    const doc = makeDoc([
      makeVersion(
        "v1",
        "Generate",
        "2026-04-30T00:30:00.000Z",
        { summary: "Old summary text.", impact: "Old impact text." }
      ),
    ]);
    render(
      <VersionHistoryPanel
        document={doc}
        onClose={vi.fn()}
        onRestore={vi.fn()}
      />
    );

    fireEvent.click(
      within(screen.getByTestId("version-row")).getByRole("button", {
        name: /^view$/i,
      })
    );

    expect(screen.getByText(/Old summary text\./)).toBeInTheDocument();
    expect(screen.getByText(/Old impact text\./)).toBeInTheDocument();
    // The version detail surfaces the section heading, not just IDs.
    expect(screen.getAllByText(/Summary/).length).toBeGreaterThan(0);
  });

  it("Restore in detail view fires onRestore with the version id", () => {
    const doc = makeDoc([
      makeVersion(
        "v1",
        "Generate",
        "2026-04-30T00:30:00.000Z",
        { summary: "Old text." }
      ),
    ]);
    const onRestore = vi.fn();
    render(
      <VersionHistoryPanel
        document={doc}
        onClose={vi.fn()}
        onRestore={onRestore}
      />
    );

    fireEvent.click(
      within(screen.getByTestId("version-row")).getByRole("button", {
        name: /^view$/i,
      })
    );
    fireEvent.click(
      screen.getByRole("button", { name: /restore this version/i })
    );
    expect(onRestore).toHaveBeenCalledWith("v1");
  });
});

describe("VersionHistoryPanel — diff view", () => {
  it("Compare button is disabled until exactly two versions are selected", () => {
    const doc = makeDoc([
      makeVersion("v1", "Generate", "2026-04-30T00:30:00.000Z", {
        summary: "Original.",
      }),
      makeVersion("v2", "Rewrite: Summary", "2026-04-30T00:45:00.000Z", {
        summary: "Rewritten.",
      }),
      makeVersion("v3", "Validate", "2026-04-30T01:00:00.000Z", {
        summary: "Rewritten.",
      }),
    ]);
    render(
      <VersionHistoryPanel
        document={doc}
        onClose={vi.fn()}
        onRestore={vi.fn()}
      />
    );

    const compareBtn = screen.getByRole("button", { name: /^compare$/i });
    expect(compareBtn).toBeDisabled();

    const checks = screen.getAllByLabelText(/select for compare/i);
    fireEvent.click(checks[0]);
    expect(compareBtn).toBeDisabled();
    fireEvent.click(checks[1]);
    expect(compareBtn).toBeEnabled();
    fireEvent.click(checks[2]);
    // Three boxes checked → still disabled (not exactly two).
    expect(compareBtn).toBeDisabled();
  });

  it("Compare renders per-section diff status (added / removed / changed / unchanged)", () => {
    const doc = makeDoc([
      makeVersion("v1", "Generate", "2026-04-30T00:30:00.000Z", {
        summary: "Same text.",
        timeline: "Old timeline.",
        removed: "Will be gone.",
      }),
      makeVersion("v2", "Rewrite: Timeline", "2026-04-30T00:45:00.000Z", {
        summary: "Same text.",
        timeline: "New timeline.",
        added: "Brand new.",
      }),
    ]);
    render(
      <VersionHistoryPanel
        document={doc}
        onClose={vi.fn()}
        onRestore={vi.fn()}
      />
    );

    const checks = screen.getAllByLabelText(/select for compare/i);
    fireEvent.click(checks[0]);
    fireEvent.click(checks[1]);
    fireEvent.click(screen.getByRole("button", { name: /^compare$/i }));

    // The diff view labels each row by section heading + status badge.
    const rows = screen.getAllByTestId("diff-row");
    const byId = Object.fromEntries(
      rows.map((row) => [row.getAttribute("data-outline-id"), row])
    );
    expect(byId.summary).toHaveTextContent(/unchanged/i);
    expect(byId.timeline).toHaveTextContent(/changed/i);
    expect(byId.added).toHaveTextContent(/added/i);
    expect(byId.removed).toHaveTextContent(/removed/i);
    // The before/after text is rendered for changed sections.
    expect(byId.timeline).toHaveTextContent(/Old timeline\./);
    expect(byId.timeline).toHaveTextContent(/New timeline\./);
  });
});
