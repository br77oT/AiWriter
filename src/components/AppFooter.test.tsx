import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { AppFooter } from "./AppFooter";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("AppFooter", () => {
  it("renders About / Contact / × controls when not hidden", () => {
    render(<AppFooter />);
    expect(screen.getByTestId("app-footer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^about$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^contact$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /hide footer/i })
    ).toBeInTheDocument();
  });

  it("× hides the upper footer but keeps the copyright bar visible", () => {
    render(<AppFooter />);
    fireEvent.click(screen.getByRole("button", { name: /hide footer/i }));
    expect(screen.queryByTestId("app-footer")).toBeNull();
    expect(screen.getByTestId("app-copyright-bar")).toBeInTheDocument();
    expect(window.localStorage.getItem("aiwriter:footerHidden")).toBe("1");
  });

  it("upper footer stays hidden when localStorage says so; copyright remains", () => {
    window.localStorage.setItem("aiwriter:footerHidden", "1");
    render(<AppFooter />);
    expect(screen.queryByTestId("app-footer")).toBeNull();
    expect(screen.getByTestId("app-copyright-bar")).toBeInTheDocument();
  });

  it("renders an always-visible © AiWriter℠ copyright line", () => {
    render(<AppFooter />);
    const copy = screen.getByTestId("app-copyright");
    expect(copy).toHaveTextContent(/© AiWriter/);
    expect(copy).toHaveTextContent("℠");
  });

  it("About button opens a modal with the about copy; Close dismisses it", () => {
    render(<AppFooter />);
    fireEvent.click(screen.getByRole("button", { name: /^about$/i }));
    const modal = screen.getByTestId("footer-modal-about");
    expect(modal).toHaveTextContent(/aiwriter turns a spec/i);
    fireEvent.click(
      screen.getByRole("button", { name: /^close$/i })
    );
    expect(screen.queryByTestId("footer-modal-about")).toBeNull();
  });

  it("Contact button opens a modal with the placeholder mailto link", () => {
    render(<AppFooter />);
    fireEvent.click(screen.getByRole("button", { name: /^contact$/i }));
    const modal = screen.getByTestId("footer-modal-contact");
    const link = modal.querySelector("a[href^='mailto:']");
    expect(link).toBeTruthy();
  });
});
