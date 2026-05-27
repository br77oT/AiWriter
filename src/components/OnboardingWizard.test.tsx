import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { OnboardingWizard } from "./OnboardingWizard";
import { BUILT_IN_TEMPLATES } from "@/lib/templates";

afterEach(() => {
  cleanup();
});

// The wizard uses the full built-in set on step 1, so feed it the real list.
// User-saved templates are deliberately excluded from onboarding —
// per the issue, step 1 is the built-in document types only.
const builtInTemplates = BUILT_IN_TEMPLATES;

describe("OnboardingWizard step 1 (pick a document type)", () => {
  it("renders every built-in document type as an option", () => {
    render(
      <OnboardingWizard
        templates={builtInTemplates}
        busy={false}
        onComplete={() => {}}
      />
    );

    for (const template of builtInTemplates) {
      expect(
        screen.getByRole("button", { name: new RegExp(template.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") })
      ).toBeInTheDocument();
    }
  });

  it("clicking Custom completes the flow immediately (skips step 2)", () => {
    const onComplete = vi.fn();
    render(
      <OnboardingWizard
        templates={builtInTemplates}
        busy={false}
        onComplete={onComplete}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Custom/i }));

    expect(onComplete).toHaveBeenCalledWith("custom");
    // Step 2 must not be rendered if Custom skips it.
    expect(
      screen.queryByRole("heading", { name: /Review preloaded/i })
    ).not.toBeInTheDocument();
  });

  it("does not list user-saved templates on step 1", () => {
    const userTemplate = {
      id: "user-1",
      name: "My weekly standup",
      builtIn: false,
      bundle: {
        spec: { goal: "", tone: "", audience: "", mustInclude: [], mustAvoid: [] },
        outline: [],
        checks: [],
      },
    };
    render(
      <OnboardingWizard
        templates={[...builtInTemplates, userTemplate]}
        busy={false}
        onComplete={() => {}}
      />
    );

    expect(
      screen.queryByRole("button", { name: /My weekly standup/i })
    ).not.toBeInTheDocument();
  });
});

describe("OnboardingWizard step 2 (preview preloaded outline + checks)", () => {
  it("clicking Incident Report advances to a preview of its outline + checks", () => {
    render(
      <OnboardingWizard
        templates={builtInTemplates}
        busy={false}
        onComplete={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Incident Report/i }));

    // Heading announces step 2.
    expect(
      screen.getByRole("heading", { name: /Review preloaded/i })
    ).toBeInTheDocument();

    // Outline headings rendered.
    expect(screen.getByText(/Summary/)).toBeInTheDocument();
    expect(screen.getByText(/Timeline/)).toBeInTheDocument();
    expect(screen.getByText(/Root Cause/)).toBeInTheDocument();
    expect(screen.getByText(/Impact/)).toBeInTheDocument();
    expect(screen.getByText(/Follow-up Actions/)).toBeInTheDocument();

    // Check questions rendered.
    expect(screen.getByText(/What happened\?/)).toBeInTheDocument();
    expect(screen.getByText(/What was the root cause\?/)).toBeInTheDocument();
  });

  it("Back returns to step 1 without firing onComplete", () => {
    const onComplete = vi.fn();
    render(
      <OnboardingWizard
        templates={builtInTemplates}
        busy={false}
        onComplete={onComplete}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Incident Report/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Back$/i }));

    // Step 1 visible again.
    expect(
      screen.getByRole("heading", { name: /Choose a document type/i })
    ).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("Use this template fires onComplete with the picked template id", () => {
    const onComplete = vi.fn();
    render(
      <OnboardingWizard
        templates={builtInTemplates}
        busy={false}
        onComplete={onComplete}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Postmortem/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Use this template/i })
    );

    expect(onComplete).toHaveBeenCalledWith("postmortem");
  });

  it("inputs on step 2 are read-only — outline preview is not editable", () => {
    render(
      <OnboardingWizard
        templates={builtInTemplates}
        busy={false}
        onComplete={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Status Report/i }));

    // No editable inputs (textareas, text inputs) on the preview screen — the
    // preview is read-only per AC: "Step 2 shows a read-only preview".
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

describe("OnboardingWizard cancel (exit the picker)", () => {
  it("does not render Cancel when onCancel is not provided (first-run state)", () => {
    render(
      <OnboardingWizard
        templates={builtInTemplates}
        busy={false}
        onComplete={() => {}}
      />
    );

    expect(
      screen.queryByRole("button", { name: /Cancel/i })
    ).not.toBeInTheDocument();
  });

  it("renders Cancel on step 1 when onCancel is provided", () => {
    const onCancel = vi.fn();
    render(
      <OnboardingWizard
        templates={builtInTemplates}
        busy={false}
        onComplete={() => {}}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("renders Cancel on step 2 (preview) too", () => {
    const onCancel = vi.fn();
    render(
      <OnboardingWizard
        templates={builtInTemplates}
        busy={false}
        onComplete={() => {}}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Incident Report/i }));
    // Preview step is visible, and Cancel is still reachable.
    expect(
      screen.getByRole("heading", { name: /Review preloaded/i })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("Escape key fires onCancel", () => {
    const onCancel = vi.fn();
    render(
      <OnboardingWizard
        templates={builtInTemplates}
        busy={false}
        onComplete={() => {}}
        onCancel={onCancel}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("Escape key is a no-op while busy (avoids cancelling mid-create)", () => {
    const onCancel = vi.fn();
    render(
      <OnboardingWizard
        templates={builtInTemplates}
        busy={true}
        onComplete={() => {}}
        onCancel={onCancel}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe("OnboardingWizard busy state", () => {
  it("disables all type buttons while busy (a request is in flight)", () => {
    render(
      <OnboardingWizard
        templates={builtInTemplates}
        busy={true}
        onComplete={() => {}}
      />
    );

    for (const template of builtInTemplates) {
      expect(
        screen.getByRole("button", { name: new RegExp(template.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") })
      ).toBeDisabled();
    }
  });

  it("disables Use this template + Back while busy on step 2", () => {
    const { rerender } = render(
      <OnboardingWizard
        templates={builtInTemplates}
        busy={false}
        onComplete={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Incident Report/i }));

    rerender(
      <OnboardingWizard
        templates={builtInTemplates}
        busy={true}
        onComplete={() => {}}
      />
    );

    expect(
      screen.getByRole("button", { name: /Use this template/i })
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Back$/i })).toBeDisabled();
  });
});
