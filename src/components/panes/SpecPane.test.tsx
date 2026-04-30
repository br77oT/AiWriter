import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { SpecPane } from "./SpecPane";
import { emptySpec, type Spec } from "@/lib/types";

afterEach(() => {
  cleanup();
});

function spec(overrides: Partial<Spec> = {}): Spec {
  return { ...emptySpec(), ...overrides };
}

describe("SpecPane", () => {
  it("renders all five fields populated from the current spec", () => {
    const onChange = vi.fn();
    render(
      <SpecPane
        spec={spec({
          goal: "Document the outage clearly.",
          tone: "Calm, factual.",
          audience: "Engineering leadership",
          mustInclude: ["timeline", "root cause"],
          mustAvoid: ["blame language"],
        })}
        onSpecChange={onChange}
      />
    );

    expect(
      (screen.getByLabelText(/^goal$/i) as HTMLTextAreaElement).value
    ).toBe("Document the outage clearly.");
    expect(
      (screen.getByLabelText(/^tone$/i) as HTMLTextAreaElement).value
    ).toBe("Calm, factual.");
    expect(
      (screen.getByLabelText(/^audience$/i) as HTMLInputElement).value
    ).toBe("Engineering leadership");

    expect(screen.getByText("timeline")).toBeInTheDocument();
    expect(screen.getByText("root cause")).toBeInTheDocument();
    expect(screen.getByText("blame language")).toBeInTheDocument();
  });

  it("editing Goal emits a new spec with the updated goal", () => {
    const onChange = vi.fn();
    render(<SpecPane spec={spec()} onSpecChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/^goal$/i), {
      target: { value: "New goal." },
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual({
      ...emptySpec(),
      goal: "New goal.",
    });
  });

  it("editing Tone and Audience emits the updated spec", () => {
    const onChange = vi.fn();
    render(<SpecPane spec={spec()} onSpecChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/^tone$/i), {
      target: { value: "Direct." },
    });
    fireEvent.change(screen.getByLabelText(/^audience$/i), {
      target: { value: "PMs" },
    });

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[0][0].tone).toBe("Direct.");
    expect(onChange.mock.calls[1][0].audience).toBe("PMs");
  });

  it("must-include is a list editor: typing + Add appends a discrete item", () => {
    const onChange = vi.fn();
    render(
      <SpecPane
        spec={spec({ mustInclude: ["timeline"] })}
        onSpecChange={onChange}
      />
    );

    const input = screen.getByLabelText(/new must-include item/i);
    fireEvent.change(input, { target: { value: "root cause" } });
    fireEvent.click(screen.getByRole("button", { name: /add must-include/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].mustInclude).toEqual([
      "timeline",
      "root cause",
    ]);
  });

  it("must-include: Remove drops the targeted item only", () => {
    const onChange = vi.fn();
    render(
      <SpecPane
        spec={spec({ mustInclude: ["timeline", "root cause", "impact"] })}
        onSpecChange={onChange}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /remove must-include "root cause"/i })
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].mustInclude).toEqual([
      "timeline",
      "impact",
    ]);
  });

  it("must-include: empty / whitespace-only entries are ignored on Add", () => {
    const onChange = vi.fn();
    render(<SpecPane spec={spec()} onSpecChange={onChange} />);

    const input = screen.getByLabelText(/new must-include item/i);
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: /add must-include/i }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("must-avoid is a separate list editor: add + remove operate on must-avoid", () => {
    const onChange = vi.fn();
    render(
      <SpecPane
        spec={spec({ mustAvoid: ["blame language"] })}
        onSpecChange={onChange}
      />
    );

    const input = screen.getByLabelText(/new must-avoid item/i);
    fireEvent.change(input, { target: { value: "speculation" } });
    fireEvent.click(screen.getByRole("button", { name: /add must-avoid/i }));

    expect(onChange.mock.calls[0][0].mustAvoid).toEqual([
      "blame language",
      "speculation",
    ]);

    onChange.mockClear();

    // Re-render with the updated spec, then remove an item.
    cleanup();
    render(
      <SpecPane
        spec={spec({ mustAvoid: ["blame language", "speculation"] })}
        onSpecChange={onChange}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: /remove must-avoid "blame language"/i })
    );
    expect(onChange.mock.calls[0][0].mustAvoid).toEqual(["speculation"]);
  });

  it("renders the spec from props on every render — no internal-state bleed", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <SpecPane
        spec={spec({ goal: "Doc A goal", mustInclude: ["A1"] })}
        onSpecChange={onChange}
      />
    );

    expect(
      (screen.getByLabelText(/^goal$/i) as HTMLTextAreaElement).value
    ).toBe("Doc A goal");
    expect(screen.getByText("A1")).toBeInTheDocument();

    rerender(
      <SpecPane
        spec={spec({ goal: "Doc B goal", mustInclude: ["B1", "B2"] })}
        onSpecChange={onChange}
      />
    );

    expect(
      (screen.getByLabelText(/^goal$/i) as HTMLTextAreaElement).value
    ).toBe("Doc B goal");
    expect(screen.queryByText("A1")).not.toBeInTheDocument();
    expect(screen.getByText("B1")).toBeInTheDocument();
    expect(screen.getByText("B2")).toBeInTheDocument();
  });
});
