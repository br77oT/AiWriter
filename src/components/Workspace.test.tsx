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
