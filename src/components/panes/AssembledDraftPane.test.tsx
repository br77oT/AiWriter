import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { AssembledDraftPane } from "./AssembledDraftPane";
import { newDocument, type Document } from "@/lib/types";

afterEach(() => cleanup());

function makeDoc(overrides: Partial<Document> = {}): Document {
  return {
    ...newDocument("doc-1", "2026-04-30T00:00:00.000Z"),
    outline: [
      { id: "summary", heading: "Summary", description: "", required: true },
      { id: "impact", heading: "Impact", description: "", required: true },
    ],
    draftSections: {
      summary: "Summary text.",
      impact: "Impact text.",
    },
    ...overrides,
  };
}

describe("AssembledDraftPane — expanded", () => {
  it("renders each section's heading and prose in outline order", () => {
    render(<AssembledDraftPane document={makeDoc()} />);
    const preview = screen.getByTestId("assembled-draft");
    expect(preview).toHaveTextContent("Summary");
    expect(preview).toHaveTextContent("Summary text.");
    expect(preview).toHaveTextContent("Impact");
    expect(preview).toHaveTextContent("Impact text.");
  });

  it("shows the description at the top of the pane", () => {
    render(<AssembledDraftPane document={makeDoc()} />);
    expect(
      screen.getByTestId("assembled-draft-description")
    ).toHaveTextContent(
      /final draft, stitched together from the numbered prompts in the draft pane/i
    );
  });

  it("marks empty sections as (empty)", () => {
    const doc = makeDoc({ draftSections: { summary: "Only summary." } });
    render(<AssembledDraftPane document={doc} />);
    const preview = screen.getByTestId("assembled-draft");
    expect(preview).toHaveTextContent("Only summary.");
    expect(preview).toHaveTextContent("(empty)");
  });

  it("shows an outline-empty notice when there are no sections", () => {
    const doc = { ...makeDoc(), outline: [], draftSections: {} };
    render(<AssembledDraftPane document={doc} />);
    expect(screen.queryByTestId("assembled-draft")).toBeNull();
    expect(screen.getByText(/outline is empty/i)).toBeInTheDocument();
  });
});

describe("AssembledDraftPane — collapsible chrome", () => {
  it("collapses to a thin strip when collapsed + onToggleCollapse is provided", () => {
    const onToggle = vi.fn();
    render(
      <AssembledDraftPane
        document={makeDoc()}
        collapsed
        onToggleCollapse={onToggle}
      />
    );
    // Pane content is replaced by the collapsed strip.
    expect(screen.queryByTestId("assembled-draft-pane")).toBeNull();
    const expand = screen.getByRole("button", { name: /expand assembled/i });
    fireEvent.click(expand);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("renders a CollapseButton in the header when onToggleCollapse is provided", () => {
    const onToggle = vi.fn();
    render(
      <AssembledDraftPane
        document={makeDoc()}
        onToggleCollapse={onToggle}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: /collapse assembled draft/i })
    );
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("hides the CollapseButton when onToggleCollapse is omitted (mobile)", () => {
    render(<AssembledDraftPane document={makeDoc()} />);
    expect(
      screen.queryByRole("button", { name: /collapse assembled draft/i })
    ).toBeNull();
  });
});
