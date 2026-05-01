import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
  within,
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
    if (url.endsWith("/api/templates")) return { templates: [] };
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
      screen.getByRole("button", { name: /^save$/i })
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

describe("Workspace checks persistence", () => {
  it("clicking Add check PUTs the document with a new check", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: /add check/i }));

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
        document: { checks: Array<{ id: string; question: string }> };
      }
    ).document.checks;
    expect(persisted).toHaveLength(1);
    expect(persisted[0].id).toBeTruthy();
    expect(persisted[0].question).toBe("");
  });

  it("toggling block-export-if-missing persists checksConfig", async () => {
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

    fireEvent.click(
      screen.getByLabelText(/block export if any check is missing/i)
    );

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
        document: {
          checksConfig: {
            evaluateAfterEveryGeneration: boolean;
            blockExportIfMissing: boolean;
          };
        };
      }
    ).document.checksConfig;
    expect(persisted.blockExportIfMissing).toBe(true);
    // The other toggle stays at its default value.
    expect(persisted.evaluateAfterEveryGeneration).toBe(true);
  });
});

describe("Workspace generation flow", () => {
  it("Generate Draft is disabled until the outline has at least one section", () => {
    const empty = newDocument("doc-empty", "2026-04-29T00:00:00.000Z");
    render(<Workspace document={empty} />);
    expect(
      screen.getByRole("button", { name: /generate draft/i })
    ).toBeDisabled();

    cleanup();

    const withOutline = {
      ...newDocument("doc-2", "2026-04-29T00:00:00.000Z"),
      outline: [
        { id: "summary", heading: "Summary", description: "", required: true },
      ],
    };
    render(<Workspace document={withOutline} />);
    expect(
      screen.getByRole("button", { name: /generate draft/i })
    ).toBeEnabled();
  });

  it("clicking Generate Draft POSTs /api/generate and applies the returned draft", async () => {
    const calls: Array<{ method: string; url: string }> = [];
    installFetch((input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ method, url });
      if (url.endsWith("/api/documents")) return { documents: [] };
      if (url.endsWith("/api/generate")) {
        return {
          document: {
            ...newDocument("doc-1", "2026-04-29T00:00:00.000Z"),
            outline: [
              {
                id: "summary",
                heading: "Summary",
                description: "",
                required: true,
              },
            ],
            draftSections: { summary: "Generated summary prose." },
          },
          draftSections: { summary: "Generated summary prose." },
        };
      }
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

    fireEvent.click(screen.getByRole("button", { name: /generate draft/i }));

    await waitFor(() =>
      expect(
        calls.some(
          (c) => c.method === "POST" && c.url.endsWith("/api/generate")
        )
      ).toBe(true)
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText(/Draft text for Summary/) as HTMLTextAreaElement
      ).toHaveValue("Generated summary prose.")
    );
  });

  it("auto-validates after Generate when 'evaluate after every generation' is ON (default)", async () => {
    const calls: Array<{ method: string; url: string }> = [];
    installFetch((input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ method, url });
      if (url.endsWith("/api/documents")) return { documents: [] };
      if (url.endsWith("/api/generate")) {
        return {
          document: {
            ...newDocument("doc-1", "2026-04-29T00:00:00.000Z"),
            outline: [
              {
                id: "summary",
                heading: "Summary",
                description: "",
                required: true,
              },
            ],
            draftSections: { summary: "Generated summary prose." },
          },
        };
      }
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
      // evaluateAfterEveryGeneration default is true.
    };
    render(<Workspace document={doc} />);

    fireEvent.click(screen.getByRole("button", { name: /generate draft/i }));

    await waitFor(() =>
      expect(
        calls.some(
          (c) => c.method === "POST" && c.url.endsWith("/api/validate")
        )
      ).toBe(true)
    );
  });

  it("does NOT auto-validate after Generate when 'evaluate after every generation' is OFF", async () => {
    const calls: Array<{ method: string; url: string }> = [];
    installFetch((input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ method, url });
      if (url.endsWith("/api/documents")) return { documents: [] };
      if (url.endsWith("/api/generate")) {
        return {
          document: {
            ...newDocument("doc-1", "2026-04-29T00:00:00.000Z"),
            outline: [
              {
                id: "summary",
                heading: "Summary",
                description: "",
                required: true,
              },
            ],
            draftSections: { summary: "Generated summary prose." },
            checksConfig: {
              evaluateAfterEveryGeneration: false,
              blockExportIfMissing: false,
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
      checksConfig: {
        evaluateAfterEveryGeneration: false,
        blockExportIfMissing: false,
      },
    };
    render(<Workspace document={doc} />);

    fireEvent.click(screen.getByRole("button", { name: /generate draft/i }));

    await waitFor(() =>
      expect(
        calls.some(
          (c) => c.method === "POST" && c.url.endsWith("/api/generate")
        )
      ).toBe(true)
    );

    // Settle any microtasks chained from the generate response, then assert
    // no validate request fired.
    await new Promise((r) => setTimeout(r, 0));
    expect(
      calls.filter(
        (c) => c.method === "POST" && c.url.endsWith("/api/validate")
      )
    ).toEqual([]);
  });
});

describe("Workspace section rewrite + lock (slice 007)", () => {
  it("toggling Lock on a section PUTs lockedSectionIds with the new id", async () => {
    const calls: Array<{ method: string; url: string; body?: unknown }> = [];
    installFetch((input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      if (url.endsWith("/api/documents")) return { documents: [] };
      return {};
    });

    const doc = {
      ...newDocument("doc-1", "2026-04-30T00:00:00.000Z"),
      outline: [
        { id: "summary", heading: "Summary", description: "", required: true },
      ],
    };
    render(<Workspace document={doc} />);

    fireEvent.click(screen.getByLabelText(/Lock section "Summary"/));

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
      (put.body as { document: { lockedSectionIds: string[] } }).document
        .lockedSectionIds
    ).toEqual(["summary"]);
  });

  it("clicking Rewrite opens the modal; submit posts to /api/generate/section and applies returned draft", async () => {
    const calls: Array<{ method: string; url: string; body?: unknown }> = [];
    installFetch((input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      if (url.endsWith("/api/documents")) return { documents: [] };
      if (url.endsWith("/api/generate/section")) {
        return {
          document: {
            ...newDocument("doc-1", "2026-04-30T00:00:00.000Z"),
            outline: [
              {
                id: "impact",
                heading: "Impact",
                description: "",
                required: true,
              },
            ],
            draftSections: { impact: "Rewritten impact prose." },
            checksConfig: {
              evaluateAfterEveryGeneration: false,
              blockExportIfMissing: false,
            },
          },
          outlineId: "impact",
          sectionText: "Rewritten impact prose.",
        };
      }
      return {};
    });

    const doc = {
      ...newDocument("doc-1", "2026-04-30T00:00:00.000Z"),
      outline: [
        { id: "impact", heading: "Impact", description: "", required: true },
      ],
      draftSections: { impact: "Original impact text." },
      checksConfig: {
        evaluateAfterEveryGeneration: false,
        blockExportIfMissing: false,
      },
    };
    render(<Workspace document={doc} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Rewrite section "Impact"/ })
    );

    // Modal opened.
    expect(
      screen.getByRole("heading", { name: /Rewrite section: Impact/ })
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Instruction/i), {
      target: { value: "Tighten the prose." },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Rewrite$/ }));

    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.method === "POST" && c.url.endsWith("/api/generate/section")
        )
      ).toBe(true)
    );

    const post = calls.find(
      (c) => c.method === "POST" && c.url.endsWith("/api/generate/section")
    )!;
    const reqBody = post.body as {
      documentId: string;
      outlineId: string;
      mode: string;
      instruction: string;
      preserve: {
        heading: boolean;
        facts: boolean;
        tone: boolean;
        otherSections: boolean;
      };
    };
    expect(reqBody.outlineId).toBe("impact");
    expect(reqBody.mode).toBe("rewrite");
    expect(reqBody.instruction).toBe("Tighten the prose.");
    expect(reqBody.preserve).toEqual({
      heading: true,
      facts: true,
      tone: true,
      otherSections: true,
    });

    await waitFor(() =>
      expect(
        screen.getByLabelText(/Draft text for Impact/) as HTMLTextAreaElement
      ).toHaveValue("Rewritten impact prose.")
    );
  });

  it("clicking Expand opens the modal in expand mode and submits with mode=expand", async () => {
    const calls: Array<{ method: string; url: string; body?: unknown }> = [];
    installFetch((input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      if (url.endsWith("/api/documents")) return { documents: [] };
      if (url.endsWith("/api/generate/section")) {
        return {
          document: {
            ...newDocument("doc-1", "2026-04-30T00:00:00.000Z"),
            outline: [
              {
                id: "impact",
                heading: "Impact",
                description: "",
                required: true,
              },
            ],
            draftSections: { impact: "Expanded prose." },
            checksConfig: {
              evaluateAfterEveryGeneration: false,
              blockExportIfMissing: false,
            },
          },
          outlineId: "impact",
          sectionText: "Expanded prose.",
        };
      }
      return {};
    });

    const doc = {
      ...newDocument("doc-1", "2026-04-30T00:00:00.000Z"),
      outline: [
        { id: "impact", heading: "Impact", description: "", required: true },
      ],
      draftSections: { impact: "Short impact." },
      checksConfig: {
        evaluateAfterEveryGeneration: false,
        blockExportIfMissing: false,
      },
    };
    render(<Workspace document={doc} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Expand section "Impact"/ })
    );

    expect(
      screen.getByRole("heading", { name: /Expand section: Impact/ })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Expand$/ }));

    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.method === "POST" && c.url.endsWith("/api/generate/section")
        )
      ).toBe(true)
    );

    const post = calls.find(
      (c) => c.method === "POST" && c.url.endsWith("/api/generate/section")
    )!;
    expect(
      (post.body as { mode: string }).mode
    ).toBe("expand");
  });
});

describe("Workspace autofix flow (slice 008)", () => {
  const reportWithFailures: ValidationReport = {
    structure: [
      { outlineId: "summary", status: "present" },
      { outlineId: "impact", status: "thin", note: "Section is brief." },
    ],
    questions: [
      {
        checkId: "c1",
        status: "missing",
        suggestion: "Insert affected groups.",
      },
    ],
    coverageScore: {
      checksAnswered: 0,
      checksTotal: 1,
      sectionsPresent: 1,
      sectionsTotal: 2,
    },
  };

  it("clicking 'Auto-fix missing items' POSTs /api/autofix with mode=questions", async () => {
    const calls: Array<{ method: string; url: string; body?: unknown }> = [];
    installFetch((input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      if (url.endsWith("/api/documents")) return { documents: [] };
      if (url.endsWith("/api/validate")) return { report: reportWithFailures };
      if (url.endsWith("/api/autofix")) {
        return {
          document: {
            ...newDocument("doc-1", "2026-04-30T00:00:00.000Z"),
            outline: [
              {
                id: "summary",
                heading: "Summary",
                description: "",
                required: true,
              },
              {
                id: "impact",
                heading: "Impact",
                description: "",
                required: true,
              },
            ],
            checks: [{ id: "c1", question: "Who was affected?" }],
            draftSections: {
              summary: "Original summary.",
              impact: "Regenerated impact prose.",
            },
          },
          draftSections: {
            summary: "Original summary.",
            impact: "Regenerated impact prose.",
          },
          regeneratedSectionIds: ["impact"],
          lockedSkipped: [],
        };
      }
      return {};
    });

    const doc = {
      ...newDocument("doc-1", "2026-04-30T00:00:00.000Z"),
      outline: [
        { id: "summary", heading: "Summary", description: "", required: true },
        { id: "impact", heading: "Impact", description: "", required: true },
      ],
      checks: [{ id: "c1", question: "Who was affected?" }],
      draftSections: {
        summary: "Original summary.",
        impact: "Original impact text.",
      },
    };
    render(<Workspace document={doc} />);

    fireEvent.click(screen.getByRole("button", { name: /^validate$/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Auto-fix missing items/ })
      ).toBeEnabled()
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Auto-fix missing items/ })
    );

    await waitFor(() =>
      expect(
        calls.some(
          (c) => c.method === "POST" && c.url.endsWith("/api/autofix")
        )
      ).toBe(true)
    );

    const post = calls.find(
      (c) => c.method === "POST" && c.url.endsWith("/api/autofix")
    )!;
    expect((post.body as { mode: string }).mode).toBe("questions");

    // After autofix, the textarea reflects the regenerated draft.
    await waitFor(() =>
      expect(
        screen.getByLabelText(/Draft text for Impact/) as HTMLTextAreaElement
      ).toHaveValue("Regenerated impact prose.")
    );

    // Validate is fired again after autofix so the rail refreshes.
    expect(
      calls.filter(
        (c) => c.method === "POST" && c.url.endsWith("/api/validate")
      ).length
    ).toBeGreaterThanOrEqual(2);
  });

  it("clicking 'Regenerate only failed sections' POSTs /api/autofix with mode=structure", async () => {
    const calls: Array<{ method: string; url: string; body?: unknown }> = [];
    installFetch((input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      if (url.endsWith("/api/documents")) return { documents: [] };
      if (url.endsWith("/api/validate")) return { report: reportWithFailures };
      if (url.endsWith("/api/autofix")) {
        return {
          document: {
            ...newDocument("doc-1", "2026-04-30T00:00:00.000Z"),
            outline: [
              {
                id: "impact",
                heading: "Impact",
                description: "",
                required: true,
              },
            ],
            checks: [],
            draftSections: { impact: "Filled-in impact." },
          },
          draftSections: { impact: "Filled-in impact." },
          regeneratedSectionIds: ["impact"],
          lockedSkipped: [],
        };
      }
      return {};
    });

    const doc = {
      ...newDocument("doc-1", "2026-04-30T00:00:00.000Z"),
      outline: [
        { id: "impact", heading: "Impact", description: "", required: true },
      ],
      checks: [],
      draftSections: { impact: "Brief." },
    };
    render(<Workspace document={doc} />);

    fireEvent.click(screen.getByRole("button", { name: /^validate$/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Regenerate only failed sections/ })
      ).toBeEnabled()
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Regenerate only failed sections/ })
    );

    await waitFor(() =>
      expect(
        calls.some(
          (c) => c.method === "POST" && c.url.endsWith("/api/autofix")
        )
      ).toBe(true)
    );

    const post = calls.find(
      (c) => c.method === "POST" && c.url.endsWith("/api/autofix")
    )!;
    expect((post.body as { mode: string }).mode).toBe("structure");
  });

  it("surfaces a locked-section notice when autofix returns lockedSkipped", async () => {
    installFetch((input) => {
      const url = String(input);
      if (url.endsWith("/api/documents")) return { documents: [] };
      if (url.endsWith("/api/validate")) return { report: reportWithFailures };
      if (url.endsWith("/api/autofix")) {
        return {
          document: {
            ...newDocument("doc-1", "2026-04-30T00:00:00.000Z"),
            outline: [
              {
                id: "summary",
                heading: "Summary",
                description: "",
                required: true,
              },
              {
                id: "impact",
                heading: "Impact",
                description: "",
                required: true,
              },
            ],
            checks: [{ id: "c1", question: "Who was affected?" }],
            draftSections: {
              summary: "Original summary.",
              impact: "Original impact.",
            },
            lockedSectionIds: ["impact"],
          },
          draftSections: {
            summary: "Original summary.",
            impact: "Original impact.",
          },
          regeneratedSectionIds: [],
          lockedSkipped: ["impact"],
        };
      }
      return {};
    });

    const doc = {
      ...newDocument("doc-1", "2026-04-30T00:00:00.000Z"),
      outline: [
        { id: "summary", heading: "Summary", description: "", required: true },
        { id: "impact", heading: "Impact", description: "", required: true },
      ],
      checks: [{ id: "c1", question: "Who was affected?" }],
      draftSections: {
        summary: "Original summary.",
        impact: "Original impact.",
      },
      lockedSectionIds: ["impact"],
    };
    render(<Workspace document={doc} />);

    fireEvent.click(screen.getByRole("button", { name: /^validate$/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Auto-fix missing items/ })
      ).toBeEnabled()
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Auto-fix missing items/ })
    );

    await waitFor(() =>
      expect(screen.getByTestId("autofix-locked-notice")).toHaveTextContent(
        /Impact/
      )
    );
  });
});

describe("Workspace template flow (slice 009)", () => {
  const incidentTemplate = {
    id: "incident-report",
    name: "Incident Report",
    builtIn: true,
    bundle: {
      spec: {
        goal: "Document the incident.",
        tone: "neutral",
        audience: "team",
        mustInclude: ["timeline"],
        mustAvoid: ["blame"],
      },
      outline: [
        { id: "summary", heading: "Summary", description: "", required: true },
        { id: "timeline", heading: "Timeline", description: "", required: true },
      ],
      checks: [
        { id: "c1", question: "What happened?" },
        { id: "c2", question: "When did it happen?" },
      ],
    },
  };

  it("selecting a template on an empty document populates Spec/Outline/Checks via PUT (no confirm)", async () => {
    const calls: Array<{ method: string; url: string; body?: unknown }> = [];
    installFetch((input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      if (url.endsWith("/api/documents")) return { documents: [] };
      if (url.endsWith("/api/templates")) {
        return { templates: [incidentTemplate] };
      }
      return {};
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    const doc = newDocument("doc-1", "2026-04-30T00:00:00.000Z");
    render(<Workspace document={doc} />);

    // Wait for the templates fetch.
    await waitFor(() =>
      expect(
        calls.some((c) => c.method === "GET" && c.url.endsWith("/api/templates"))
      ).toBe(true)
    );

    fireEvent.change(screen.getByRole("combobox", { name: /^template$/i }), {
      target: { value: "incident-report" },
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

    // Empty document → no confirm prompt.
    expect(confirmSpy).not.toHaveBeenCalled();

    const put = calls.find(
      (c) => c.method === "PUT" && c.url.endsWith(`/api/documents/${doc.id}`)
    )!;
    const body = put.body as {
      document: {
        spec: { goal: string };
        outline: Array<{ id: string }>;
        checks: Array<{ id: string }>;
      };
    };
    expect(body.document.spec.goal).toBe("Document the incident.");
    expect(body.document.outline.map((s) => s.id)).toEqual([
      "summary",
      "timeline",
    ]);
    expect(body.document.checks.map((c) => c.id)).toEqual(["c1", "c2"]);

    confirmSpy.mockRestore();
  });

  it("selecting a template on a non-empty document prompts for confirmation; cancel skips the change", async () => {
    const calls: Array<{ method: string; url: string; body?: unknown }> = [];
    installFetch((input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      if (url.endsWith("/api/documents")) return { documents: [] };
      if (url.endsWith("/api/templates")) {
        return { templates: [incidentTemplate] };
      }
      return {};
    });
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false);

    const doc = {
      ...newDocument("doc-1", "2026-04-30T00:00:00.000Z"),
      outline: [
        { id: "x", heading: "Existing", description: "", required: true },
      ],
    };
    render(<Workspace document={doc} />);

    await waitFor(() =>
      expect(
        calls.some((c) => c.method === "GET" && c.url.endsWith("/api/templates"))
      ).toBe(true)
    );

    const putCountBefore = calls.filter(
      (c) => c.method === "PUT" && c.url.endsWith(`/api/documents/${doc.id}`)
    ).length;

    fireEvent.change(screen.getByRole("combobox", { name: /^template$/i }), {
      target: { value: "incident-report" },
    });

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    // Cancelled → no PUT for the template change.
    const putCountAfter = calls.filter(
      (c) => c.method === "PUT" && c.url.endsWith(`/api/documents/${doc.id}`)
    ).length;
    expect(putCountAfter).toBe(putCountBefore);

    confirmSpy.mockRestore();
  });

  it("Save as template POSTs /api/templates with the current spec/outline/checks bundle", async () => {
    const calls: Array<{ method: string; url: string; body?: unknown }> = [];
    installFetch((input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      if (url.endsWith("/api/documents")) return { documents: [] };
      if (url.endsWith("/api/templates") && method === "GET") {
        return { templates: [] };
      }
      if (url.endsWith("/api/templates") && method === "POST") {
        return {
          template: {
            id: "user-1",
            name: "My standup",
            builtIn: false,
            bundle: (body as { bundle: unknown }).bundle,
          },
        };
      }
      return {};
    });
    const promptSpy = vi
      .spyOn(window, "prompt")
      .mockReturnValueOnce("My standup");

    const doc = {
      ...newDocument("doc-1", "2026-04-30T00:00:00.000Z"),
      spec: {
        goal: "Daily standup",
        tone: "concise",
        audience: "team",
        mustInclude: ["yesterday"],
        mustAvoid: [],
      },
      outline: [
        { id: "y", heading: "Yesterday", description: "", required: true },
      ],
      checks: [{ id: "c1", question: "What did you do yesterday?" }],
    };
    render(<Workspace document={doc} />);

    fireEvent.click(
      screen.getByRole("button", { name: /save as template/i })
    );

    await waitFor(() =>
      expect(
        calls.some(
          (c) => c.method === "POST" && c.url.endsWith("/api/templates")
        )
      ).toBe(true)
    );

    const post = calls.find(
      (c) => c.method === "POST" && c.url.endsWith("/api/templates")
    )!;
    const reqBody = post.body as {
      name: string;
      bundle: {
        spec: { goal: string };
        outline: Array<{ id: string }>;
        checks: Array<{ id: string }>;
      };
    };
    expect(reqBody.name).toBe("My standup");
    expect(reqBody.bundle.spec.goal).toBe("Daily standup");
    expect(reqBody.bundle.outline.map((s) => s.id)).toEqual(["y"]);
    expect(reqBody.bundle.checks.map((c) => c.id)).toEqual(["c1"]);

    promptSpy.mockRestore();
  });

  it("Save as template button is disabled when the document is empty", () => {
    installFetch((input) => {
      const url = String(input);
      if (url.endsWith("/api/documents")) return { documents: [] };
      if (url.endsWith("/api/templates")) return { templates: [] };
      return {};
    });

    const doc = newDocument("doc-empty", "2026-04-30T00:00:00.000Z");
    render(<Workspace document={doc} />);

    expect(
      screen.getByRole("button", { name: /save as template/i })
    ).toBeDisabled();
  });

  it("ChecksPane Load template opens the picker; picking a template applies it via PUT", async () => {
    const calls: Array<{ method: string; url: string; body?: unknown }> = [];
    installFetch((input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      if (url.endsWith("/api/documents")) return { documents: [] };
      if (url.endsWith("/api/templates")) {
        return { templates: [incidentTemplate] };
      }
      return {};
    });

    const doc = newDocument("doc-1", "2026-04-30T00:00:00.000Z");
    render(<Workspace document={doc} />);

    await waitFor(() =>
      expect(
        calls.some(
          (c) => c.method === "GET" && c.url.endsWith("/api/templates")
        )
      ).toBe(true)
    );

    fireEvent.click(
      screen.getByRole("button", { name: /^load template$/i })
    );

    // Picker modal opens.
    const dialog = screen.getByRole("dialog", { name: /load a template/i });
    expect(dialog).toBeInTheDocument();

    // Scope to the dialog so we don't collide with the same-labelled button
    // that lives in the Sidebar Templates list.
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: /load template incident report/i,
      })
    );

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
      (put.body as { document: { templateId: string } }).document.templateId
    ).toBe("incident-report");
  });

  it("Sidebar Templates section lists built-in templates with a Load button", async () => {
    installFetch((input) => {
      const url = String(input);
      if (url.endsWith("/api/documents")) return { documents: [] };
      if (url.endsWith("/api/templates")) {
        return { templates: [incidentTemplate] };
      }
      return {};
    });

    const doc = newDocument("doc-1", "2026-04-30T00:00:00.000Z");
    render(<Workspace document={doc} />);

    // Wait for the templates fetch + render.
    await waitFor(() =>
      expect(
        screen
          .getAllByRole("button", { name: /load template incident report/i })
          .length
      ).toBeGreaterThan(0)
    );
  });
});

describe("Workspace version history flow (slice 011)", () => {
  it("History button is disabled when versions is empty and enabled once a version exists", () => {
    const empty = newDocument("doc-1", "2026-04-30T00:00:00.000Z");
    render(<Workspace document={empty} />);
    expect(screen.getByRole("button", { name: /^history/i })).toBeDisabled();

    cleanup();

    const withVersion = {
      ...newDocument("doc-2", "2026-04-30T00:00:00.000Z"),
      versions: [
        {
          id: "v1",
          label: "Generate",
          timestamp: "2026-04-30T01:00:00.000Z",
          draftSections: { summary: "old text" },
          validationReport: null,
        },
      ],
    };
    render(<Workspace document={withVersion} />);
    expect(screen.getByRole("button", { name: /^history/i })).toBeEnabled();
  });

  it("clicking History opens the panel; clicking Restore POSTs the restore endpoint and applies the returned doc", async () => {
    const calls: Array<{ method: string; url: string }> = [];
    installFetch((input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ method, url });
      if (url.endsWith("/api/documents")) return { documents: [] };
      if (url.endsWith("/api/templates")) return { templates: [] };
      if (url.includes("/restore")) {
        return {
          document: {
            ...newDocument("doc-1", "2026-04-30T00:00:00.000Z"),
            outline: [
              {
                id: "summary",
                heading: "Summary",
                description: "",
                required: true,
              },
            ],
            draftSections: { summary: "Restored old text." },
            versions: [
              {
                id: "v1",
                label: "Generate",
                timestamp: "2026-04-30T01:00:00.000Z",
                draftSections: { summary: "Restored old text." },
                validationReport: null,
              },
              {
                id: "v2",
                label: "Restore: Generate",
                timestamp: "2026-04-30T02:00:00.000Z",
                draftSections: { summary: "Restored old text." },
                validationReport: null,
              },
            ],
          },
        };
      }
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
      ...newDocument("doc-1", "2026-04-30T00:00:00.000Z"),
      outline: [
        { id: "summary", heading: "Summary", description: "", required: true },
      ],
      draftSections: { summary: "Current text." },
      versions: [
        {
          id: "v1",
          label: "Generate",
          timestamp: "2026-04-30T01:00:00.000Z",
          draftSections: { summary: "Restored old text." },
          validationReport: null,
        },
      ],
    };
    render(<Workspace document={doc} />);

    fireEvent.click(screen.getByRole("button", { name: /^history/i }));

    // Panel opens.
    expect(
      screen.getByRole("dialog", { name: /version history/i })
    ).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByTestId("version-row")).getByRole("button", {
        name: /^restore$/i,
      })
    );

    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.method === "POST" &&
            c.url.endsWith(`/api/documents/${doc.id}/versions/v1/restore`)
        )
      ).toBe(true)
    );

    // After restore, the live draft reflects the restored text.
    await waitFor(() =>
      expect(
        screen.getByLabelText(/Draft text for Summary/) as HTMLTextAreaElement
      ).toHaveValue("Restored old text.")
    );
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

describe("Workspace export flow (slice 012)", () => {
  beforeEach(() => {
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn(async () => undefined) },
    });
  });

  it("Export button is enabled once any draft section has content", () => {
    const doc = {
      ...newDocument("doc-1", "2026-04-30T00:00:00.000Z"),
      outline: [
        { id: "summary", heading: "Summary", description: "", required: true },
      ],
      draftSections: { summary: "Pipe burst at 03:15." },
    };
    render(<Workspace document={doc} />);

    expect(screen.getByRole("button", { name: /^export$/i })).toBeEnabled();
  });

  it("opening Export with no current report triggers validate before showing the popover", async () => {
    const calls: Array<{ method: string; url: string }> = [];
    installFetch((input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ method, url });
      if (url.endsWith("/api/documents")) return { documents: [] };
      if (url.endsWith("/api/templates")) return { templates: [] };
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
      ...newDocument("doc-1", "2026-04-30T00:00:00.000Z"),
      outline: [
        { id: "summary", heading: "Summary", description: "", required: true },
      ],
      draftSections: { summary: "Body." },
    };
    render(<Workspace document={doc} />);

    fireEvent.click(screen.getByRole("button", { name: /^export$/i }));

    // Popover renders.
    expect(
      screen.getByRole("button", { name: /download markdown/i })
    ).toBeInTheDocument();

    // Validate was kicked off because there was no current report.
    await waitFor(() =>
      expect(
        calls.some(
          (c) => c.method === "POST" && c.url.endsWith("/api/validate")
        )
      ).toBe(true)
    );
  });

  it("with block-if-missing ON and a fresh failing report, export actions are disabled and failing checks are listed", async () => {
    installFetch((input) => {
      const url = String(input);
      if (url.endsWith("/api/documents")) return { documents: [] };
      if (url.endsWith("/api/templates")) return { templates: [] };
      if (url.endsWith("/api/validate")) {
        return {
          report: {
            structure: [{ outlineId: "summary", status: "present" }],
            questions: [{ checkId: "c1", status: "missing" }],
            coverageScore: {
              checksAnswered: 0,
              checksTotal: 1,
              sectionsPresent: 1,
              sectionsTotal: 1,
            },
          },
        };
      }
      return {};
    });

    const doc = {
      ...newDocument("doc-1", "2026-04-30T00:00:00.000Z"),
      outline: [
        { id: "summary", heading: "Summary", description: "", required: true },
      ],
      checks: [{ id: "c1", question: "What happened?" }],
      checksConfig: {
        evaluateAfterEveryGeneration: true,
        blockExportIfMissing: true,
      },
      draftSections: { summary: "Body." },
    };
    render(<Workspace document={doc} />);

    // Run validate first so the popover opens with a fresh report.
    fireEvent.click(screen.getByRole("button", { name: /^validate$/i }));
    await waitFor(() =>
      expect(screen.getByTestId("coverage-score")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: /^export$/i }));

    expect(
      screen.getByRole("button", { name: /download markdown/i })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /download plain text/i })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /copy to clipboard/i })
    ).toBeDisabled();

    // Failing-check question text appears in the blocked notice.
    const notice = screen.getByTestId("export-blocked-notice");
    expect(notice).toHaveTextContent(/What happened\?/);
  });
});
