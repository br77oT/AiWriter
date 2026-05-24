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

  it("× hides the whole footer and persists the choice to localStorage", () => {
    render(<AppFooter />);
    fireEvent.click(screen.getByRole("button", { name: /hide footer/i }));
    expect(screen.queryByTestId("app-footer")).toBeNull();
    expect(window.localStorage.getItem("aiwriter:footerHidden")).toBe("1");
  });

  it("stays hidden on subsequent renders when localStorage says so", () => {
    window.localStorage.setItem("aiwriter:footerHidden", "1");
    render(<AppFooter />);
    expect(screen.queryByTestId("app-footer")).toBeNull();
  });

  it("renders the © 2026 AiWriter℠ copyright on the same row as the links", () => {
    render(<AppFooter />);
    const footer = screen.getByTestId("app-footer");
    const copy = screen.getByTestId("app-copyright");
    // Copyright sits inside the same footer element as the About/Contact links.
    expect(footer.contains(copy)).toBe(true);
    expect(copy).toHaveTextContent(/© 2026 AiWriter/);
    expect(copy).toHaveTextContent("℠");
  });

  it("About button opens a modal with the problem-focused copy; Close dismisses it", () => {
    render(<AppFooter />);
    fireEvent.click(screen.getByRole("button", { name: /^about$/i }));
    const modal = screen.getByTestId("footer-modal-about");
    // Lead sentence frames the audience.
    expect(modal).toHaveTextContent(/structured documents/i);
    // Each of the four problem bullets is named in bold.
    expect(modal).toHaveTextContent(/drafts drift/i);
    expect(modal).toHaveTextContent(/can.t tell if the result/i);
    expect(modal).toHaveTextContent(/re-prompting/i);
    expect(modal).toHaveTextContent(/black-box/i);
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
