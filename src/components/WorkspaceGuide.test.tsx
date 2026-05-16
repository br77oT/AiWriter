import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { WorkspaceGuide } from "./WorkspaceGuide";
import { newDocument, type Document } from "@/lib/types";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function makeDoc(overrides: Partial<Document> = {}): Document {
  return { ...newDocument("doc-1", "2026-05-01T00:00:00.000Z"), ...overrides };
}

const OUTLINE = [
  { id: "summary", heading: "Summary", description: "", required: true },
];

function renderGuide(props: Partial<Parameters<typeof WorkspaceGuide>[0]> = {}) {
  const handlers = {
    onNewDocument: vi.fn(),
    onSelectTemplate: vi.fn(),
    onWriteDraft: vi.fn(),
    onGenerate: vi.fn(),
    onValidate: vi.fn(),
  };
  render(
    <WorkspaceGuide
      document={makeDoc()}
      generating={false}
      validating={false}
      canGenerate={false}
      {...handlers}
      {...props}
    />
  );
  return handlers;
}

describe("WorkspaceGuide — steps", () => {
  it("renders the five workflow steps in order", () => {
    renderGuide();
    for (const label of [
      "New document",
      "Pick a template",
      "Write the draft",
      "Generate draft",
      "Validate",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("clicking a step runs its action", () => {
    const h = renderGuide({ document: makeDoc({ outline: OUTLINE }) });
    fireEvent.click(screen.getByRole("button", { name: "Guide: pick a template" }));
    fireEvent.click(screen.getByRole("button", { name: "Guide: write the draft" }));
    fireEvent.click(screen.getByRole("button", { name: "Guide: validate the draft" }));
    expect(h.onSelectTemplate).toHaveBeenCalledTimes(1);
    expect(h.onWriteDraft).toHaveBeenCalledTimes(1);
    expect(h.onValidate).toHaveBeenCalledTimes(1);
  });

  it("disables Generate when generation is not yet possible", () => {
    renderGuide({ canGenerate: false });
    expect(
      screen.getByRole("button", { name: "Guide: generate the draft" })
    ).toBeDisabled();
  });

  it("enables Generate once an outline exists", () => {
    renderGuide({ document: makeDoc({ outline: OUTLINE }), canGenerate: true });
    expect(
      screen.getByRole("button", { name: "Guide: generate the draft" })
    ).toBeEnabled();
  });
});

describe("WorkspaceGuide — current step", () => {
  it("points an empty document at Pick a template", () => {
    renderGuide();
    expect(
      screen.getByRole("button", { name: "Guide: pick a template" })
    ).toHaveAttribute("aria-current", "step");
  });

  it("advances to Write the draft once an outline exists", () => {
    renderGuide({ document: makeDoc({ outline: OUTLINE }) });
    expect(
      screen.getByRole("button", { name: "Guide: pick a template" })
    ).not.toHaveAttribute("aria-current");
    expect(
      screen.getByRole("button", { name: "Guide: write the draft" })
    ).toHaveAttribute("aria-current", "step");
  });

  it("advances to Validate once the draft has content", () => {
    renderGuide({
      document: makeDoc({
        outline: OUTLINE,
        draftSections: { summary: "Some written text." },
      }),
    });
    expect(
      screen.getByRole("button", { name: "Guide: validate the draft" })
    ).toHaveAttribute("aria-current", "step");
  });
});

describe("WorkspaceGuide — collapse", () => {
  it("collapses to a pill and expands again, persisting the choice", () => {
    renderGuide();
    fireEvent.click(
      screen.getByRole("button", { name: "Hide the getting-started guide" })
    );
    expect(screen.queryByLabelText("Getting-started guide")).toBeNull();
    expect(window.localStorage.getItem("aiwriter:guideCollapsed")).toBe("1");

    fireEvent.click(
      screen.getByRole("button", { name: "Open the getting-started guide" })
    );
    expect(screen.getByLabelText("Getting-started guide")).toBeInTheDocument();
    expect(window.localStorage.getItem("aiwriter:guideCollapsed")).toBe("0");
  });

  it("starts collapsed when the saved preference says so", () => {
    window.localStorage.setItem("aiwriter:guideCollapsed", "1");
    renderGuide();
    expect(
      screen.getByRole("button", { name: "Open the getting-started guide" })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Getting-started guide")).toBeNull();
  });
});
