import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { TemplatePickerModal } from "./TemplatePickerModal";
import type { Template } from "@/lib/templates";

afterEach(() => {
  cleanup();
});

const sampleTemplates: Template[] = [
  {
    id: "incident-report",
    name: "Incident Report",
    builtIn: true,
    bundle: {
      spec: { goal: "", tone: "", audience: "", mustInclude: [], mustAvoid: [] },
      outline: [],
      checks: [],
    },
  },
  {
    id: "user-1",
    name: "My standup",
    builtIn: false,
    bundle: {
      spec: { goal: "", tone: "", audience: "", mustInclude: [], mustAvoid: [] },
      outline: [],
      checks: [],
    },
  },
];

describe("TemplatePickerModal", () => {
  it("renders one row per template, labeled Built-in vs Saved", () => {
    render(
      <TemplatePickerModal
        templates={sampleTemplates}
        busy={false}
        onCancel={() => {}}
        onPick={() => {}}
      />
    );

    expect(
      screen.getByRole("button", { name: /load template incident report/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /load template my standup/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Built-in/i)).toBeInTheDocument();
    expect(screen.getByText(/Saved/i)).toBeInTheDocument();
  });

  it("clicking a template fires onPick with the template id", () => {
    const onPick = vi.fn();
    render(
      <TemplatePickerModal
        templates={sampleTemplates}
        busy={false}
        onCancel={() => {}}
        onPick={onPick}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /load template incident report/i })
    );
    expect(onPick).toHaveBeenCalledWith("incident-report");
  });

  it("clicking Cancel fires onCancel", () => {
    const onCancel = vi.fn();
    render(
      <TemplatePickerModal
        templates={sampleTemplates}
        busy={false}
        onCancel={onCancel}
        onPick={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("disables all buttons when busy", () => {
    render(
      <TemplatePickerModal
        templates={sampleTemplates}
        busy={true}
        onCancel={() => {}}
        onPick={() => {}}
      />
    );
    for (const t of sampleTemplates) {
      expect(
        screen.getByRole("button", { name: new RegExp(`load template ${t.name}`, "i") })
      ).toBeDisabled();
    }
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeDisabled();
  });

  it("numbers each row 1..N in order, matching the templates array", () => {
    render(
      <TemplatePickerModal
        templates={sampleTemplates}
        busy={false}
        onCancel={() => {}}
        onPick={() => {}}
      />
    );
    // Each list item has a numbered chip as its first visual element.
    for (let i = 0; i < sampleTemplates.length; i++) {
      expect(screen.getByText(String(i + 1))).toBeInTheDocument();
    }
  });

  it("shows the template's goal as the description and audience as 'For: …'", () => {
    const withSpec: Template = {
      id: "business-plan",
      name: "Business Plan",
      builtIn: true,
      bundle: {
        spec: {
          goal: "Lay out the business clearly.",
          tone: "confident",
          audience: "investors and partners",
          mustInclude: [],
          mustAvoid: [],
        },
        outline: [],
        checks: [],
      },
    };
    render(
      <TemplatePickerModal
        templates={[withSpec]}
        busy={false}
        onCancel={() => {}}
        onPick={() => {}}
      />
    );
    expect(screen.getByText(/Lay out the business clearly\./)).toBeInTheDocument();
    expect(
      screen.getByText(/For: investors and partners/)
    ).toBeInTheDocument();
  });

  it("hides the description + audience lines when those Spec fields are empty", () => {
    // Mirrors a user-saved template the user never filled spec fields on, and
    // the Custom (blank) built-in. The row should collapse to just the name.
    render(
      <TemplatePickerModal
        templates={sampleTemplates}
        busy={false}
        onCancel={() => {}}
        onPick={() => {}}
      />
    );
    expect(screen.queryByText(/^For:/)).toBeNull();
  });

  it("renders an empty hint when no templates exist", () => {
    render(
      <TemplatePickerModal
        templates={[]}
        busy={false}
        onCancel={() => {}}
        onPick={() => {}}
      />
    );
    expect(screen.getByText(/no templates available/i)).toBeInTheDocument();
  });
});
