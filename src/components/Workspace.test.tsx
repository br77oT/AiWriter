import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { Workspace } from "./Workspace";
import { newDocument, type ValidationReport } from "@/lib/types";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// Reusable fake fetch — by default returns empty doc list and a placeholder
// validation report. Tests can override individual responses by reading the
// URL/method out of the call args.
function installFetch(handler: (input: RequestInfo, init?: RequestInit) => unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const result = await handler(input, init);
      return {
        ok: true,
        status: 200,
        json: async () => result,
      };
    })
  );
}

beforeEach(() => {
  installFetch((input) => {
    const url = String(input);
    if (url.endsWith("/api/documents")) return { documents: [] };
    return {};
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Workspace shell", () => {
  it("renders all five panes with clear text labels", () => {
    const doc = newDocument("doc-1", "2026-04-29T00:00:00.000Z");
    render(<Workspace document={doc} />);

    expect(
      screen.getByRole("heading", { name: /spec/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /outline/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /checks/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^draft$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /validation/i })
    ).toBeInTheDocument();
  });

  it("renders top-bar actions with text labels; Validate is enabled", () => {
    const doc = newDocument("doc-1", "2026-04-29T00:00:00.000Z");
    render(<Workspace document={doc} />);

    expect(
      screen.getByRole("button", { name: /save/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generate draft/i })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /^validate$/i })
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /^export$/i })
    ).toBeDisabled();
    expect(
      screen.getByRole("combobox", { name: /^template$/i })
    ).toBeInTheDocument();
  });

  it("persists last-opened document id to localStorage", () => {
    const doc = newDocument("doc-42", "2026-04-29T00:00:00.000Z");
    render(<Workspace document={doc} />);

    expect(
      window.localStorage.getItem("aiwriter:lastOpenedDocId")
    ).toBe("doc-42");
  });
});

describe("Workspace validation flow", () => {
  it("clicking Validate renders the report in the rail", async () => {
    const report: ValidationReport = {
      structure: [{ outlineId: "summary", status: "present" }],
      questions: [
        {
          checkId: "c1",
          status: "answered",
          evidence: "Pipe burst at 03:15.",
        },
      ],
      coverageScore: {
        checksAnswered: 1,
        checksTotal: 1,
        sectionsPresent: 1,
        sectionsTotal: 1,
      },
    };
    installFetch((input) => {
      const url = String(input);
      if (url.endsWith("/api/documents")) return { documents: [] };
      if (url.endsWith("/api/validate")) return { report };
      return {};
    });

    const doc = {
      ...newDocument("doc-1", "2026-04-29T00:00:00.000Z"),
      outline: [
        { id: "summary", heading: "Summary", description: "", required: true },
      ],
      checks: [{ id: "c1", question: "What happened?" }],
    };
    render(<Workspace document={doc} />);

    fireEvent.click(screen.getByRole("button", { name: /^validate$/i }));

    await waitFor(() =>
      expect(screen.getByTestId("coverage-score")).toBeInTheDocument()
    );
    expect(screen.getByTestId("coverage-score").textContent).toMatch(
      /1\/1 checks/
    );
    expect(screen.getAllByText(/Summary/).length).toBeGreaterThan(0);
    expect(screen.getByText(/What happened\?/)).toBeInTheDocument();
    expect(screen.getByText(/Pipe burst at 03:15/)).toBeInTheDocument();
    expect(screen.getByText(/Answered/)).toBeInTheDocument();
  });

  it("editing a draft section triggers a debounced re-validate", async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    installFetch((input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push(`${method} ${url}`);
      if (url.endsWith("/api/documents")) return { documents: [] };
      if (url.endsWith("/api/validate")) {
        return {
          report: {
            structure: [],
            questions: [],
            coverageScore: {
              checksAnswered: 0,
              checksTotal: 0,
              sectionsPresent: 0,
              sectionsTotal: 0,
            },
          },
        };
      }
      return {};
    });

    const doc = {
      ...newDocument("doc-1", "2026-04-29T00:00:00.000Z"),
      outline: [
        { id: "summary", heading: "Summary", description: "", required: true },
      ],
    };
    render(<Workspace document={doc} />);

    const textarea = screen.getByLabelText(/Draft text for Summary/);
    fireEvent.change(textarea, { target: { value: "first edit" } });
    fireEvent.change(textarea, { target: { value: "second edit" } });

    // Before the debounce window, no validate call has fired.
    expect(calls.some((c) => c.includes("/api/validate"))).toBe(false);

    // Advance past the debounce.
    await vi.advanceTimersByTimeAsync(700);
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    await waitFor(() =>
      expect(calls.some((c) => c.startsWith("POST /api/validate"))).toBe(true)
    );
    // Multiple edits collapse to a single validate call.
    expect(
      calls.filter((c) => c.startsWith("POST /api/validate")).length
    ).toBe(1);
  });
});

describe("Workspace outline persistence", () => {
  it("clicking Add section PUTs the document with a new outline section", async () => {
    const calls: Array<{ method: string; url: string; body?: unknown }> = [];
    installFetch((input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      if (url.endsWith("/api/documents")) return { documents: [] };
      return {};
    });

    const doc = newDocument("doc-1", "2026-04-29T00:00:00.000Z");
    render(<Workspace document={doc} />);

    fireEvent.click(screen.getByRole("button", { name: /add section/i }));

    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.method === "PUT" &&
            c.url.endsWith(`/api/documents/${doc.id}`)
        )
      ).toBe(true)
    );

    const put = calls.find(
      (c) =>
        c.method === "PUT" && c.url.endsWith(`/api/documents/${doc.id}`)
    )!;
    const persisted = (
      put.body as {
        document: { outline: Array<{ required: boolean }> };
      }
    ).document.outline;
    expect(persisted).toHaveLength(1);
    expect(persisted[0].required).toBe(true);
  });

  it("toggling Freeze persists outlineFrozen=true", async () => {
    const calls: Array<{ method: string; url: string; body?: unknown }> = [];
    installFetch((input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      if (url.endsWith("/api/documents")) return { documents: [] };
      return {};
    });

    const doc = newDocument("doc-1", "2026-04-29T00:00:00.000Z");
    render(<Workspace document={doc} />);

    fireEvent.click(screen.getByLabelText(/freeze outline/i));

    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.method === "PUT" &&
            c.url.endsWith(`/api/documents/${doc.id}`)
        )
      ).toBe(true)
    );

    const put = calls.find(
      (c) =>
        c.method === "PUT" && c.url.endsWith(`/api/documents/${doc.id}`)
    )!;
    expect(
      (put.body as { document: { outlineFrozen: boolean } }).document
        .outlineFrozen
    ).toBe(true);
  });
});

describe("Workspace spec persistence", () => {
  it("editing a spec field PUTs the document with the new spec", async () => {
    const calls: Array<{ method: string; url: string; body?: unknown }> = [];
    installFetch((input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      if (url.endsWith("/api/documents")) return { documents: [] };
      return {};
    });

    const doc = newDocument("doc-1", "2026-04-29T00:00:00.000Z");
    render(<Workspace document={doc} />);

    fireEvent.change(screen.getByLabelText(/^goal$/i), {
      target: { value: "Document the outage." },
    });

    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.method === "PUT" &&
            c.url.endsWith(`/api/documents/${doc.id}`)
        )
      ).toBe(true)
    );

    const put = calls.find(
      (c) =>
        c.method === "PUT" && c.url.endsWith(`/api/documents/${doc.id}`)
    )!;
    expect(
      (put.body as { document: { spec: { goal: string } } }).document.spec.goal
    ).toBe("Document the outage.");
  });
});
