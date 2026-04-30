import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ChecksPane } from "./ChecksPane";
import {
  emptyChecksConfig,
  type Check,
  type ChecksConfig,
} from "@/lib/types";

afterEach(() => {
  cleanup();
});

function cfg(overrides: Partial<ChecksConfig> = {}): ChecksConfig {
  return { ...emptyChecksConfig(), ...overrides };
}

function noop() {}

describe("ChecksPane — rendering", () => {
  it("lists every check question with a Remove button per row", () => {
    render(
      <ChecksPane
        checks={[
          { id: "c1", question: "What happened?" },
          { id: "c2", question: "When did it happen?" },
        ]}
        checksConfig={cfg()}
        onChecksChange={noop}
        onChecksConfigChange={noop}
      />
    );

    expect(screen.getByDisplayValue("What happened?")).toBeInTheDocument();
    expect(screen.getByDisplayValue("When did it happen?")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /remove check "what happened\?"/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /remove check "when did it happen\?"/i })
    ).toBeInTheDocument();
  });

  it("renders both toggles reflecting the current config", () => {
    render(
      <ChecksPane
        checks={[]}
        checksConfig={cfg({
          evaluateAfterEveryGeneration: true,
          blockExportIfMissing: false,
        })}
        onChecksChange={noop}
        onChecksConfigChange={noop}
      />
    );

    expect(
      screen.getByLabelText(/evaluate after every generation/i)
    ).toBeChecked();
    expect(
      screen.getByLabelText(/block export if any check is missing/i)
    ).not.toBeChecked();
  });

  it("renders an empty-state hint when there are no checks", () => {
    render(
      <ChecksPane
        checks={[]}
        checksConfig={cfg()}
        onChecksChange={noop}
        onChecksConfigChange={noop}
      />
    );
    expect(screen.getByText(/no checks yet/i)).toBeInTheDocument();
  });

  it("renders a Load template button as a placeholder for slice 009", () => {
    render(
      <ChecksPane
        checks={[]}
        checksConfig={cfg()}
        onChecksChange={noop}
        onChecksConfigChange={noop}
      />
    );
    const button = screen.getByRole("button", { name: /load template/i });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });
});

describe("ChecksPane — add / edit / remove", () => {
  it("Add check appends a new check with a stable id", () => {
    const onChange = vi.fn();
    render(
      <ChecksPane
        checks={[{ id: "c1", question: "What happened?" }]}
        checksConfig={cfg()}
        onChecksChange={onChange}
        onChecksConfigChange={noop}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /add check/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as Check[];
    expect(next).toHaveLength(2);
    expect(next[0].id).toBe("c1");
    expect(next[1].id).toBeTruthy();
    expect(next[1].id).not.toBe("c1");
    expect(next[1].question).toBe("");
  });

  it("editing a question text emits the updated check; ids preserved", () => {
    const onChange = vi.fn();
    render(
      <ChecksPane
        checks={[
          { id: "c1", question: "What happened?" },
          { id: "c2", question: "When?" },
        ]}
        checksConfig={cfg()}
        onChecksChange={onChange}
        onChecksConfigChange={noop}
      />
    );

    fireEvent.change(screen.getByDisplayValue("When?"), {
      target: { value: "When did it happen?" },
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as Check[];
    expect(next.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(next[1].question).toBe("When did it happen?");
  });

  it("Remove drops the targeted check only", () => {
    const onChange = vi.fn();
    render(
      <ChecksPane
        checks={[
          { id: "c1", question: "What happened?" },
          { id: "c2", question: "When?" },
          { id: "c3", question: "Who was affected?" },
        ]}
        checksConfig={cfg()}
        onChecksChange={onChange}
        onChecksConfigChange={noop}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /remove check "when\?"/i })
    );

    const next = onChange.mock.calls[0][0] as Check[];
    expect(next.map((c) => c.id)).toEqual(["c1", "c3"]);
  });

  it("editing one check's text leaves sibling check ids unchanged", () => {
    // Acceptance criterion: "check IDs survive edits to other checks".
    const onChange = vi.fn();
    render(
      <ChecksPane
        checks={[
          { id: "c1", question: "What happened?" },
          { id: "c2", question: "When?" },
        ]}
        checksConfig={cfg()}
        onChecksChange={onChange}
        onChecksConfigChange={noop}
      />
    );

    fireEvent.change(screen.getByDisplayValue("What happened?"), {
      target: { value: "What occurred?" },
    });

    const next = onChange.mock.calls[0][0] as Check[];
    // Sibling id is bit-identical.
    expect(next[1]).toEqual({ id: "c2", question: "When?" });
  });
});

describe("ChecksPane — toggles", () => {
  it("toggling evaluate-after-every-generation calls onChecksConfigChange", () => {
    const onConfigChange = vi.fn();
    render(
      <ChecksPane
        checks={[]}
        checksConfig={cfg({ evaluateAfterEveryGeneration: true })}
        onChecksChange={noop}
        onChecksConfigChange={onConfigChange}
      />
    );

    fireEvent.click(screen.getByLabelText(/evaluate after every generation/i));

    expect(onConfigChange).toHaveBeenCalledTimes(1);
    expect(onConfigChange.mock.calls[0][0]).toEqual({
      evaluateAfterEveryGeneration: false,
      blockExportIfMissing: false,
    });
  });

  it("toggling block-export-if-missing calls onChecksConfigChange", () => {
    const onConfigChange = vi.fn();
    render(
      <ChecksPane
        checks={[]}
        checksConfig={cfg({ blockExportIfMissing: false })}
        onChecksChange={noop}
        onChecksConfigChange={onConfigChange}
      />
    );

    fireEvent.click(
      screen.getByLabelText(/block export if any check is missing/i)
    );

    expect(onConfigChange).toHaveBeenCalledTimes(1);
    expect(onConfigChange.mock.calls[0][0]).toEqual({
      evaluateAfterEveryGeneration: true,
      blockExportIfMissing: true,
    });
  });
});

describe("ChecksPane — controlled component, no internal-state bleed", () => {
  it("re-rendering with a different checks list replaces the displayed rows", () => {
    const { rerender } = render(
      <ChecksPane
        checks={[
          { id: "a1", question: "DocA Q1" },
          { id: "a2", question: "DocA Q2" },
        ]}
        checksConfig={cfg()}
        onChecksChange={noop}
        onChecksConfigChange={noop}
      />
    );
    expect(screen.getByDisplayValue("DocA Q1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("DocA Q2")).toBeInTheDocument();

    rerender(
      <ChecksPane
        checks={[{ id: "b1", question: "DocB only" }]}
        checksConfig={cfg()}
        onChecksChange={noop}
        onChecksConfigChange={noop}
      />
    );
    expect(screen.queryByDisplayValue("DocA Q1")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("DocA Q2")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("DocB only")).toBeInTheDocument();
  });

  it("re-rendering with a different checksConfig flips the toggles", () => {
    const { rerender } = render(
      <ChecksPane
        checks={[]}
        checksConfig={cfg({
          evaluateAfterEveryGeneration: true,
          blockExportIfMissing: false,
        })}
        onChecksChange={noop}
        onChecksConfigChange={noop}
      />
    );
    expect(
      screen.getByLabelText(/evaluate after every generation/i)
    ).toBeChecked();
    expect(
      screen.getByLabelText(/block export if any check is missing/i)
    ).not.toBeChecked();

    rerender(
      <ChecksPane
        checks={[]}
        checksConfig={cfg({
          evaluateAfterEveryGeneration: false,
          blockExportIfMissing: true,
        })}
        onChecksChange={noop}
        onChecksConfigChange={noop}
      />
    );
    expect(
      screen.getByLabelText(/evaluate after every generation/i)
    ).not.toBeChecked();
    expect(
      screen.getByLabelText(/block export if any check is missing/i)
    ).toBeChecked();
  });
});
