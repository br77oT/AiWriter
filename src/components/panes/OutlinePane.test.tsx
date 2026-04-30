import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { OutlinePane } from "./OutlinePane";
import type { OutlineSection } from "@/lib/types";

afterEach(() => {
  cleanup();
});

function s(
  id: string,
  overrides: Partial<OutlineSection> = {}
): OutlineSection {
  return {
    id,
    heading: overrides.heading ?? id.toUpperCase(),
    description: overrides.description ?? "",
    required: overrides.required ?? true,
    ...(overrides.parentId !== undefined ? { parentId: overrides.parentId } : {}),
  };
}

describe("OutlinePane — rendering", () => {
  it("lists every section with heading, description, and Required/Optional badge", () => {
    const onOutlineChange = vi.fn();
    const onFrozenChange = vi.fn();
    render(
      <OutlinePane
        outline={[
          s("a", {
            heading: "Summary",
            description: "Short incident summary",
            required: true,
          }),
          s("b", {
            heading: "Appendix",
            description: "Optional supporting material",
            required: false,
          }),
        ]}
        outlineFrozen={false}
        onOutlineChange={onOutlineChange}
        onFrozenChange={onFrozenChange}
      />
    );

    expect(screen.getByDisplayValue("Summary")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Short incident summary")
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Appendix")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Optional supporting material")
    ).toBeInTheDocument();

    // Each row's required toggle should reflect its current value.
    const requiredToggles = screen.getAllByRole("checkbox", {
      name: /required/i,
    });
    // Two row-level required toggles, in document order.
    expect(requiredToggles[0]).toBeChecked();
    expect(requiredToggles[1]).not.toBeChecked();
  });

  it("renders an empty-state hint when there are no sections", () => {
    render(
      <OutlinePane
        outline={[]}
        outlineFrozen={false}
        onOutlineChange={vi.fn()}
        onFrozenChange={vi.fn()}
      />
    );
    expect(screen.getByText(/no sections yet/i)).toBeInTheDocument();
  });
});

describe("OutlinePane — add / edit / remove", () => {
  it("Add section appends a new Required section with a stable id", () => {
    const onChange = vi.fn();
    render(
      <OutlinePane
        outline={[s("a", { heading: "Summary" })]}
        outlineFrozen={false}
        onOutlineChange={onChange}
        onFrozenChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /add section/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as OutlineSection[];
    expect(next).toHaveLength(2);
    expect(next[0].id).toBe("a");
    expect(next[1].id).toBeTruthy();
    expect(next[1].id).not.toBe("a");
    expect(next[1].required).toBe(true);
  });

  it("editing a heading emits the updated outline with the same ids", () => {
    const onChange = vi.fn();
    render(
      <OutlinePane
        outline={[
          s("a", { heading: "Summary" }),
          s("b", { heading: "Timeline" }),
        ]}
        outlineFrozen={false}
        onOutlineChange={onChange}
        onFrozenChange={vi.fn()}
      />
    );

    fireEvent.change(screen.getByDisplayValue("Timeline"), {
      target: { value: "Sequence of events" },
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as OutlineSection[];
    expect(next.map((x) => x.id)).toEqual(["a", "b"]);
    expect(next[1].heading).toBe("Sequence of events");
  });

  it("editing a description emits the updated outline", () => {
    const onChange = vi.fn();
    render(
      <OutlinePane
        outline={[s("a", { heading: "Summary", description: "" })]}
        outlineFrozen={false}
        onOutlineChange={onChange}
        onFrozenChange={vi.fn()}
      />
    );

    const descInput = screen.getByLabelText(/description for summary/i);
    fireEvent.change(descInput, { target: { value: "Short summary." } });
    expect(onChange.mock.calls[0][0][0].description).toBe("Short summary.");
  });

  it("toggling Required round-trips the flag for the correct section only", () => {
    const onChange = vi.fn();
    render(
      <OutlinePane
        outline={[
          s("a", { heading: "Summary", required: true }),
          s("b", { heading: "Appendix", required: false }),
        ]}
        outlineFrozen={false}
        onOutlineChange={onChange}
        onFrozenChange={vi.fn()}
      />
    );

    // Untoggle Summary (id=a).
    const summaryToggle = screen.getByLabelText(/required for summary/i);
    fireEvent.click(summaryToggle);

    const next = onChange.mock.calls[0][0] as OutlineSection[];
    expect(next[0].required).toBe(false);
    expect(next[1].required).toBe(false);
  });

  it("Remove drops the targeted section only", () => {
    const onChange = vi.fn();
    render(
      <OutlinePane
        outline={[
          s("a", { heading: "Summary" }),
          s("b", { heading: "Timeline" }),
          s("c", { heading: "Impact" }),
        ]}
        outlineFrozen={false}
        onOutlineChange={onChange}
        onFrozenChange={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /remove section timeline/i })
    );

    const next = onChange.mock.calls[0][0] as OutlineSection[];
    expect(next.map((x) => x.id)).toEqual(["a", "c"]);
  });
});

describe("OutlinePane — reorder", () => {
  it("Move down swaps the section with its successor; ids preserved", () => {
    const onChange = vi.fn();
    render(
      <OutlinePane
        outline={[
          s("a", { heading: "Summary" }),
          s("b", { heading: "Timeline" }),
          s("c", { heading: "Impact" }),
        ]}
        outlineFrozen={false}
        onOutlineChange={onChange}
        onFrozenChange={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /move section summary down/i })
    );

    const next = onChange.mock.calls[0][0] as OutlineSection[];
    expect(next.map((x) => x.id)).toEqual(["b", "a", "c"]);
  });

  it("Move up swaps the section with its predecessor; ids preserved", () => {
    const onChange = vi.fn();
    render(
      <OutlinePane
        outline={[
          s("a", { heading: "Summary" }),
          s("b", { heading: "Timeline" }),
        ]}
        outlineFrozen={false}
        onOutlineChange={onChange}
        onFrozenChange={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /move section timeline up/i })
    );

    const next = onChange.mock.calls[0][0] as OutlineSection[];
    expect(next.map((x) => x.id)).toEqual(["b", "a"]);
  });
});

describe("OutlinePane — freeze toggle", () => {
  it("Freeze toggle calls onFrozenChange with the new value", () => {
    const onFrozenChange = vi.fn();
    render(
      <OutlinePane
        outline={[s("a")]}
        outlineFrozen={false}
        onOutlineChange={vi.fn()}
        onFrozenChange={onFrozenChange}
      />
    );
    fireEvent.click(screen.getByLabelText(/freeze outline/i));
    expect(onFrozenChange).toHaveBeenCalledWith(true);
  });

  it("when frozen: Add, Remove, Move, and heading edits are disabled", () => {
    const onChange = vi.fn();
    render(
      <OutlinePane
        outline={[
          s("a", { heading: "Summary" }),
          s("b", { heading: "Timeline" }),
        ]}
        outlineFrozen={true}
        onOutlineChange={onChange}
        onFrozenChange={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /add section/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /remove section summary/i })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /move section summary down/i })
    ).toBeDisabled();
    expect(screen.getByDisplayValue("Summary")).toBeDisabled();
  });

  it("when frozen: description and required-flag remain editable", () => {
    const onChange = vi.fn();
    render(
      <OutlinePane
        outline={[s("a", { heading: "Summary", required: true })]}
        outlineFrozen={true}
        onOutlineChange={onChange}
        onFrozenChange={vi.fn()}
      />
    );

    const descInput = screen.getByLabelText(/description for summary/i);
    expect(descInput).not.toBeDisabled();
    fireEvent.change(descInput, { target: { value: "frozen-edit" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(
      (onChange.mock.calls[0][0] as OutlineSection[])[0].description
    ).toBe("frozen-edit");

    onChange.mockClear();

    const requiredToggle = screen.getByLabelText(/required for summary/i);
    expect(requiredToggle).not.toBeDisabled();
    fireEvent.click(requiredToggle);
    expect(
      (onChange.mock.calls[0][0] as OutlineSection[])[0].required
    ).toBe(false);
  });
});

describe("OutlinePane — controlled component, no internal-state bleed", () => {
  it("re-rendering with a different outline replaces the displayed sections", () => {
    const { rerender } = render(
      <OutlinePane
        outline={[s("a", { heading: "DocA-1" }), s("b", { heading: "DocA-2" })]}
        outlineFrozen={false}
        onOutlineChange={vi.fn()}
        onFrozenChange={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue("DocA-1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("DocA-2")).toBeInTheDocument();

    rerender(
      <OutlinePane
        outline={[s("x", { heading: "DocB-only" })]}
        outlineFrozen={false}
        onOutlineChange={vi.fn()}
        onFrozenChange={vi.fn()}
      />
    );
    expect(screen.queryByDisplayValue("DocA-1")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("DocA-2")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("DocB-only")).toBeInTheDocument();
  });
});
