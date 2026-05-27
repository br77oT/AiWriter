import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { AppMenu } from "./AppMenu";
import { newDocument, type Document } from "@/lib/types";

afterEach(() => {
  cleanup();
});

function makeDoc(overrides: Partial<Document> = {}): Document {
  return { ...newDocument("doc-1", "2026-05-01T00:00:00.000Z"), ...overrides };
}

function renderMenu(props: Partial<Parameters<typeof AppMenu>[0]> = {}) {
  const handlers = {
    onNewDocument: vi.fn(),
    onOpenTemplatePicker: vi.fn(),
    onWriteDraft: vi.fn(),
    onGenerate: vi.fn(),
    onValidate: vi.fn(),
    onOpenHistory: vi.fn(),
    onOpenPrompts: vi.fn(),
    onShareScenario: vi.fn(),
    onOpenExport: vi.fn(),
    onSaveAsTemplate: vi.fn(),
    onToggleReviewerMode: vi.fn(),
  };
  render(
    <AppMenu
      document={makeDoc()}
      generating={false}
      validating={false}
      canGenerate={false}
      canExport={false}
      canSaveAsTemplate={false}
      versionCount={0}
      hasPromptLog={false}
      reviewerMode={false}
      {...handlers}
      {...props}
    />
  );
  return handlers;
}

describe("AppMenu — collapsed by default", () => {
  it("renders the hamburger trigger and no panel until clicked", () => {
    renderMenu();
    expect(screen.getByTestId("app-menu-button")).toBeInTheDocument();
    expect(screen.queryByTestId("app-menu-panel")).toBeNull();
  });

  it("clicking the trigger opens the panel with both sections + divider", () => {
    renderMenu();
    fireEvent.click(screen.getByTestId("app-menu-button"));

    expect(screen.getByTestId("app-menu-panel")).toBeInTheDocument();
    // Section headers in order: Getting started, then App actions.
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual([
      "Getting started",
      "App actions",
    ]);
    // hr divider separates the two sections.
    expect(screen.getByTestId("app-menu-divider")).toBeInTheDocument();
  });
});

describe("AppMenu — Getting-started section (top half)", () => {
  it("lists the same five workflow steps as WorkspaceGuide", () => {
    renderMenu();
    fireEvent.click(screen.getByTestId("app-menu-button"));
    for (const label of [
      "New document",
      "Pick a template",
      "Write the draft",
      "Generate draft",
      "Validate",
    ]) {
      // Each step is its own button; the section heading is `Getting started`.
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("clicking a step fires the matching handler and closes the menu", async () => {
    const handlers = renderMenu();
    fireEvent.click(screen.getByTestId("app-menu-button"));
    fireEvent.click(screen.getByRole("menuitem", { name: /New document/i }));

    expect(handlers.onNewDocument).toHaveBeenCalledTimes(1);
    // Panel plays a fade-out before unmounting.
    await waitFor(() =>
      expect(screen.queryByTestId("app-menu-panel")).toBeNull()
    );
  });
});

describe("AppMenu — App-actions section (bottom half)", () => {
  it("shows History disabled when there are no versions", () => {
    renderMenu({ versionCount: 0 });
    fireEvent.click(screen.getByTestId("app-menu-button"));

    const btn = screen.getByRole("menuitem", { name: /^History/i });
    expect(btn).toBeDisabled();
  });

  it("shows History enabled and labels with the count when versions exist", () => {
    const handlers = renderMenu({ versionCount: 3 });
    fireEvent.click(screen.getByTestId("app-menu-button"));

    const btn = screen.getByRole("menuitem", { name: /History \(3\)/i });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(handlers.onOpenHistory).toHaveBeenCalledTimes(1);
  });

  it("hides Share / Export / Save-as-template / Generate / Validate in reviewer mode", () => {
    renderMenu({ reviewerMode: true });
    fireEvent.click(screen.getByTestId("app-menu-button"));

    expect(
      screen.queryByRole("menuitem", { name: /Share link/i })
    ).toBeNull();
    expect(screen.queryByRole("menuitem", { name: /^Export$/i })).toBeNull();
    expect(
      screen.queryByRole("menuitem", { name: /Save as template/i })
    ).toBeNull();
    expect(
      screen.queryByRole("menuitem", { name: /Generate Draft/i })
    ).toBeNull();
    expect(screen.queryByRole("menuitem", { name: /^Validate$/i })).toBeNull();
  });

  it("toggling Reviewer mode fires the handler", () => {
    const handlers = renderMenu();
    fireEvent.click(screen.getByTestId("app-menu-button"));
    fireEvent.click(screen.getByLabelText("Reviewer mode"));
    expect(handlers.onToggleReviewerMode).toHaveBeenCalledWith(true);
  });

  it("About opens the InfoModal", () => {
    renderMenu();
    fireEvent.click(screen.getByTestId("app-menu-button"));
    fireEvent.click(screen.getByRole("menuitem", { name: /About/i }));
    expect(screen.getByTestId("app-menu-modal-about")).toBeInTheDocument();
  });
});

describe("AppMenu — dismissal", () => {
  it("Escape closes the menu", async () => {
    renderMenu();
    fireEvent.click(screen.getByTestId("app-menu-button"));
    expect(screen.getByTestId("app-menu-panel")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByTestId("app-menu-panel")).toBeNull()
    );
  });

  it("clicking outside the menu closes it", async () => {
    renderMenu();
    fireEvent.click(screen.getByTestId("app-menu-button"));
    expect(screen.getByTestId("app-menu-panel")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    await waitFor(() =>
      expect(screen.queryByTestId("app-menu-panel")).toBeNull()
    );
  });
});
