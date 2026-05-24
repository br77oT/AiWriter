import { describe, it, expect, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MobileWorkspaceLayout } from "./MobileWorkspaceLayout";

afterEach(() => cleanup());

function renderLayout() {
  return render(
    <MobileWorkspaceLayout
      sidebar={<div data-testid="sidebar-content">Sidebar</div>}
      spec={<div data-testid="pane-spec">Spec content</div>}
      outline={<div data-testid="pane-outline">Outline content</div>}
      checks={<div data-testid="pane-checks">Checks content</div>}
      draft={<div data-testid="pane-draft">Draft content</div>}
      assembled={<div data-testid="pane-assembled">Assembled content</div>}
      stats={<div data-testid="pane-stats">Stats content</div>}
      validation={<div data-testid="pane-validation">Validation content</div>}
    />
  );
}

describe("MobileWorkspaceLayout", () => {
  it("renders all seven tabs with clear text labels", () => {
    renderLayout();
    const tablist = screen.getByRole("tablist", { name: /workspace panes/i });
    expect(within(tablist).getByRole("tab", { name: /tone and purpose/i })).toBeInTheDocument();
    expect(within(tablist).getByRole("tab", { name: /document outline/i })).toBeInTheDocument();
    expect(within(tablist).getByRole("tab", { name: /validation checks/i })).toBeInTheDocument();
    expect(within(tablist).getByRole("tab", { name: /^draft$/i })).toBeInTheDocument();
    expect(within(tablist).getByRole("tab", { name: /^assembled$/i })).toBeInTheDocument();
    expect(within(tablist).getByRole("tab", { name: /^stats$/i })).toBeInTheDocument();
    expect(within(tablist).getByRole("tab", { name: /^validation$/i })).toBeInTheDocument();
  });

  it("Assembled tab swaps in the assembled-draft pane", () => {
    renderLayout();
    fireEvent.click(screen.getByRole("tab", { name: /^assembled$/i }));
    expect(
      screen.getByRole("tab", { name: /^assembled$/i })
    ).toHaveAttribute("aria-selected", "true");
    expect(
      within(screen.getByTestId("mobile-active-pane-assembled")).getByTestId(
        "pane-assembled"
      )
    ).toBeInTheDocument();
  });

  it("defaults to the Tone and Purpose tab; only its pane is in the active-pane area", () => {
    renderLayout();
    expect(
      screen.getByRole("tab", { name: /tone and purpose/i })
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("mobile-active-pane-spec")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("mobile-active-pane-spec")).getByTestId("pane-spec")
    ).toBeInTheDocument();
    // Only one active pane container is in the DOM at a time.
    expect(screen.queryByTestId("mobile-active-pane-outline")).toBeNull();
  });

  it("clicking a tab switches the visible pane", () => {
    renderLayout();
    fireEvent.click(screen.getByRole("tab", { name: /document outline/i }));
    expect(
      screen.getByRole("tab", { name: /document outline/i })
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("mobile-active-pane-outline")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("mobile-active-pane-outline")).getByTestId("pane-outline")
    ).toBeInTheDocument();
    expect(screen.queryByTestId("mobile-active-pane-spec")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /^validation$/i }));
    expect(
      within(screen.getByTestId("mobile-active-pane-validation")).getByTestId("pane-validation")
    ).toBeInTheDocument();
  });

  it("Menu button opens a drawer containing the sidebar; Close dismisses it", () => {
    renderLayout();
    expect(
      screen.queryByRole("dialog", { name: /documents and templates drawer/i })
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^menu$/i }));
    const drawer = screen.getByRole("dialog", {
      name: /documents and templates drawer/i,
    });
    expect(within(drawer).getByTestId("sidebar-content")).toBeInTheDocument();

    fireEvent.click(within(drawer).getByRole("button", { name: /^close$/i }));
    expect(
      screen.queryByRole("dialog", { name: /documents and templates drawer/i })
    ).toBeNull();
  });

  it("clicking the backdrop closes the drawer", () => {
    renderLayout();
    fireEvent.click(screen.getByRole("button", { name: /^menu$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^close drawer$/i }));
    expect(
      screen.queryByRole("dialog", { name: /documents and templates drawer/i })
    ).toBeNull();
  });
});
