import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { DraftPane } from "./DraftPane";
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

describe("DraftPane — lock toggle", () => {
  it("renders an unchecked Lock checkbox per section by default", () => {
    const doc = makeDoc();
    render(
      <DraftPane
        document={doc}
        onDraftSectionChange={() => {}}
        onLockToggle={() => {}}
        onRewrite={() => {}}
        onExpand={() => {}}
      />
    );
    const summaryLock = screen.getByLabelText(/Lock section "Summary"/);
    expect(summaryLock).not.toBeChecked();
  });

  it("renders the Lock checkbox checked for sections in lockedSectionIds", () => {
    const doc = makeDoc({ lockedSectionIds: ["impact"] });
    render(
      <DraftPane
        document={doc}
        onDraftSectionChange={() => {}}
        onLockToggle={() => {}}
        onRewrite={() => {}}
        onExpand={() => {}}
      />
    );
    expect(screen.getByLabelText(/Lock section "Summary"/)).not.toBeChecked();
    expect(screen.getByLabelText(/Lock section "Impact"/)).toBeChecked();
  });

  it("toggling the Lock checkbox calls onLockToggle with (outlineId, locked)", () => {
    const doc = makeDoc();
    const calls: Array<{ id: string; locked: boolean }> = [];
    render(
      <DraftPane
        document={doc}
        onDraftSectionChange={() => {}}
        onLockToggle={(id, locked) => calls.push({ id, locked })}
        onRewrite={() => {}}
        onExpand={() => {}}
      />
    );
    fireEvent.click(screen.getByLabelText(/Lock section "Impact"/));
    expect(calls).toEqual([{ id: "impact", locked: true }]);
  });

  it("disables the textarea for locked sections", () => {
    const doc = makeDoc({ lockedSectionIds: ["impact"] });
    render(
      <DraftPane
        document={doc}
        onDraftSectionChange={() => {}}
        onLockToggle={() => {}}
        onRewrite={() => {}}
        onExpand={() => {}}
      />
    );
    expect(screen.getByLabelText(/Draft text for Impact/)).toBeDisabled();
    expect(screen.getByLabelText(/Draft text for Summary/)).toBeEnabled();
  });
});

describe("DraftPane — Rewrite / Expand buttons", () => {
  it("renders Rewrite and Expand buttons per section", () => {
    const doc = makeDoc();
    render(
      <DraftPane
        document={doc}
        onDraftSectionChange={() => {}}
        onLockToggle={() => {}}
        onRewrite={() => {}}
        onExpand={() => {}}
      />
    );
    expect(
      screen.getByRole("button", { name: /Rewrite section "Summary"/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Expand section "Summary"/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Rewrite section "Impact"/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Expand section "Impact"/ })
    ).toBeInTheDocument();
  });

  it("clicking Rewrite calls onRewrite with the outlineId", () => {
    const doc = makeDoc();
    const onRewrite = vi.fn();
    render(
      <DraftPane
        document={doc}
        onDraftSectionChange={() => {}}
        onLockToggle={() => {}}
        onRewrite={onRewrite}
        onExpand={() => {}}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Rewrite section "Impact"/ })
    );
    expect(onRewrite).toHaveBeenCalledWith("impact");
  });

  it("clicking Expand calls onExpand with the outlineId", () => {
    const doc = makeDoc();
    const onExpand = vi.fn();
    render(
      <DraftPane
        document={doc}
        onDraftSectionChange={() => {}}
        onLockToggle={() => {}}
        onRewrite={() => {}}
        onExpand={onExpand}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Expand section "Summary"/ })
    );
    expect(onExpand).toHaveBeenCalledWith("summary");
  });

  it("disables Rewrite and Expand buttons for locked sections", () => {
    const doc = makeDoc({ lockedSectionIds: ["impact"] });
    render(
      <DraftPane
        document={doc}
        onDraftSectionChange={() => {}}
        onLockToggle={() => {}}
        onRewrite={() => {}}
        onExpand={() => {}}
      />
    );
    expect(
      screen.getByRole("button", { name: /Rewrite section "Impact"/ })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Expand section "Impact"/ })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Rewrite section "Summary"/ })
    ).toBeEnabled();
  });
});

describe("DraftPane — Insert example text", () => {
  it("shows Insert example only for empty sections", () => {
    const doc = makeDoc({ draftSections: { summary: "Already written." } });
    render(
      <DraftPane
        document={doc}
        onDraftSectionChange={() => {}}
        onLockToggle={() => {}}
        onRewrite={() => {}}
        onExpand={() => {}}
      />
    );
    // impact has no draft text → button present; summary is filled → absent.
    expect(
      screen.getByRole("button", {
        name: /Insert example text for section "Impact"/,
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /Insert example text for section "Summary"/,
      })
    ).not.toBeInTheDocument();
  });

  it("treats whitespace-only sections as empty", () => {
    const doc = makeDoc({ draftSections: { summary: "   ", impact: "" } });
    render(
      <DraftPane
        document={doc}
        onDraftSectionChange={() => {}}
        onLockToggle={() => {}}
        onRewrite={() => {}}
        onExpand={() => {}}
      />
    );
    expect(
      screen.getByRole("button", {
        name: /Insert example text for section "Summary"/,
      })
    ).toBeInTheDocument();
  });

  it("clicking Insert example fills the section with non-empty starter text", () => {
    const doc = makeDoc({ draftSections: {} });
    const calls: Array<{ id: string; text: string }> = [];
    render(
      <DraftPane
        document={doc}
        onDraftSectionChange={(id, text) => calls.push({ id, text })}
        onLockToggle={() => {}}
        onRewrite={() => {}}
        onExpand={() => {}}
      />
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /Insert example text for section "Summary"/,
      })
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].id).toBe("summary");
    // The starter is a real worked example — actual prose, not instructions.
    expect(calls[0].text.length).toBeGreaterThan(80);
    expect(calls[0].text).toMatch(/checkout service was unavailable/);
  });

  it("inserts a different worked example per section heading", () => {
    const doc = makeDoc({ draftSections: {} });
    const calls: Array<{ id: string; text: string }> = [];
    render(
      <DraftPane
        document={doc}
        onDraftSectionChange={(id, text) => calls.push({ id, text })}
        onLockToggle={() => {}}
        onRewrite={() => {}}
        onExpand={() => {}}
      />
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /Insert example text for section "Summary"/,
      })
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /Insert example text for section "Impact"/,
      })
    );
    const summaryText = calls.find((c) => c.id === "summary")!.text;
    const impactText = calls.find((c) => c.id === "impact")!.text;
    expect(summaryText).not.toEqual(impactText);
    expect(impactText).toMatch(/1,800 customers/);
  });

  it("hides Insert example in readOnly mode", () => {
    const doc = makeDoc({ draftSections: {} });
    render(
      <DraftPane
        document={doc}
        onDraftSectionChange={() => {}}
        onLockToggle={() => {}}
        onRewrite={() => {}}
        onExpand={() => {}}
        readOnly
      />
    );
    expect(
      screen.queryByRole("button", {
        name: /Insert example text/,
      })
    ).not.toBeInTheDocument();
  });

  it("disables Insert example for locked sections", () => {
    const doc = makeDoc({ draftSections: {}, lockedSectionIds: ["impact"] });
    render(
      <DraftPane
        document={doc}
        onDraftSectionChange={() => {}}
        onLockToggle={() => {}}
        onRewrite={() => {}}
        onExpand={() => {}}
      />
    );
    expect(
      screen.getByRole("button", {
        name: /Insert example text for section "Impact"/,
      })
    ).toBeDisabled();
  });
});
