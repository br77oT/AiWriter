import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { SectionRewriteModal } from "./SectionRewriteModal";

afterEach(() => cleanup());

describe("SectionRewriteModal", () => {
  it("renders the heading with the target section name and the four preserve toggles", () => {
    render(
      <SectionRewriteModal
        sectionHeading="Impact"
        mode="rewrite"
        onCancel={() => {}}
        onSubmit={() => {}}
      />
    );
    expect(
      screen.getByRole("heading", { name: /Rewrite section: Impact/ })
    ).toBeInTheDocument();

    // The four preserve toggles, all checked by default.
    const headingToggle = screen.getByLabelText(/Heading text/);
    const factsToggle = screen.getByLabelText(/Factual claims already present/);
    const toneToggle = screen.getByLabelText(/Tone and style/);
    const otherToggle = screen.getByLabelText(/Do not edit other sections/);
    expect(headingToggle).toBeChecked();
    expect(factsToggle).toBeChecked();
    expect(toneToggle).toBeChecked();
    expect(otherToggle).toBeChecked();
  });

  it("expand mode shows an Expand title", () => {
    render(
      <SectionRewriteModal
        sectionHeading="Impact"
        mode="expand"
        onCancel={() => {}}
        onSubmit={() => {}}
      />
    );
    expect(
      screen.getByRole("heading", { name: /Expand section: Impact/ })
    ).toBeInTheDocument();
  });

  it("clicking Cancel calls onCancel", () => {
    const onCancel = vi.fn();
    render(
      <SectionRewriteModal
        sectionHeading="Impact"
        mode="rewrite"
        onCancel={onCancel}
        onSubmit={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Cancel/ }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("clicking Rewrite calls onSubmit with instruction and preserve flags", () => {
    const onSubmit = vi.fn();
    render(
      <SectionRewriteModal
        sectionHeading="Impact"
        mode="rewrite"
        onCancel={() => {}}
        onSubmit={onSubmit}
      />
    );
    fireEvent.change(screen.getByLabelText(/Instruction/i), {
      target: { value: "Add operational impact." },
    });
    fireEvent.click(screen.getByLabelText(/Tone and style/));

    fireEvent.click(screen.getByRole("button", { name: /^Rewrite$/ }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      instruction: "Add operational impact.",
      preserve: {
        heading: true,
        facts: true,
        tone: false,
        otherSections: true,
      },
    });
  });

  it("expand mode submit button reads Expand", () => {
    const onSubmit = vi.fn();
    render(
      <SectionRewriteModal
        sectionHeading="Impact"
        mode="expand"
        onCancel={() => {}}
        onSubmit={onSubmit}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^Expand$/ }));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("disables submit while busy", () => {
    render(
      <SectionRewriteModal
        sectionHeading="Impact"
        mode="rewrite"
        busy
        onCancel={() => {}}
        onSubmit={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: /Rewriting…/ })).toBeDisabled();
  });
});
