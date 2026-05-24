import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { PromptInspectorPanel } from "./PromptInspectorPanel";
import type { PromptLog } from "@/lib/llm";

afterEach(cleanup);

function makeLog(overrides: Partial<PromptLog> = {}): PromptLog {
  return {
    kind: "Generate",
    timestamp: "2026-05-18T12:00:00.000Z",
    exchanges: [
      {
        systemPrompt: "You are a structured document drafter.",
        messages: [{ role: "user", content: 'Write the section "Summary".' }],
        response: "Drafted: Summary",
      },
      {
        systemPrompt: "You are a structured document drafter.",
        messages: [{ role: "user", content: 'Write the section "Impact".' }],
        response: "Drafted: Impact",
      },
    ],
    ...overrides,
  };
}

describe("PromptInspectorPanel", () => {
  it("renders one collapsible block per captured exchange", () => {
    render(<PromptInspectorPanel log={makeLog()} onClose={() => {}} />);
    expect(screen.getAllByTestId("prompt-exchange")).toHaveLength(2);
    expect(screen.getByText("Prompt 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("Prompt 2 of 2")).toBeInTheDocument();
  });

  it("shows the system prompt, user message, and response text", () => {
    render(<PromptInspectorPanel log={makeLog()} onClose={() => {}} />);
    // Both exchanges share the same system prompt text.
    expect(
      screen.getAllByText("You are a structured document drafter.")
    ).toHaveLength(2);
    expect(
      screen.getByText('Write the section "Summary".')
    ).toBeInTheDocument();
    expect(screen.getByText("Drafted: Summary")).toBeInTheDocument();
  });

  it("shows the action kind and prompt count in the header", () => {
    render(
      <PromptInspectorPanel
        log={makeLog({ kind: "Validate" })}
        onClose={() => {}}
      />
    );
    expect(screen.getByText(/Validate · 2 prompts/)).toBeInTheDocument();
  });

  it("shows an empty state when no log has been captured", () => {
    render(<PromptInspectorPanel log={null} onClose={() => {}} />);
    expect(screen.getByText(/No prompts captured yet/)).toBeInTheDocument();
  });

  it("handles a log with no exchanges", () => {
    render(
      <PromptInspectorPanel
        log={makeLog({ exchanges: [] })}
        onClose={() => {}}
      />
    );
    expect(
      screen.getByText(/did not send any prompts/)
    ).toBeInTheDocument();
  });

  it("invokes onClose when Close is clicked", () => {
    const onClose = vi.fn();
    render(<PromptInspectorPanel log={makeLog()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
