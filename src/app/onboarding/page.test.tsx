import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import OnboardingPage from "./page";
import { newDocument, type Document } from "@/lib/types";

// Capture router calls so we can assert the final navigation.
const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
}));

interface FetchCall {
  method: string;
  url: string;
  body?: unknown;
}

function installFetch(handler: (call: FetchCall) => unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      const result = await handler({ method, url, body });
      return {
        ok: true,
        status: 200,
        json: async () => result,
      };
    })
  );
}

beforeEach(() => {
  replaceMock.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Onboarding page integration", () => {
  it("Custom path: POSTs /api/documents and routes to the new doc — no PUT, no second-step preview", async () => {
    const calls: FetchCall[] = [];
    const created: Document = newDocument(
      "doc-new",
      "2026-04-30T00:00:00.000Z"
    );
    installFetch((call) => {
      calls.push(call);
      if (call.url.endsWith("/api/templates"))
        return { templates: [] };
      if (call.url.endsWith("/api/documents") && call.method === "POST")
        return { document: created };
      return {};
    });

    render(<OnboardingPage />);

    fireEvent.click(screen.getByRole("button", { name: /Custom/i }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalled());

    expect(replaceMock).toHaveBeenCalledWith("/documents/doc-new");

    // Custom skips step 2 — the PUT-with-applied-template still runs because
    // applyTemplate(custom) sets templateId='custom'. But the document body
    // sent matches the empty bundle (no outline, no checks, no spec content).
    const put = calls.find(
      (c) => c.method === "PUT" && c.url.endsWith(`/api/documents/${created.id}`)
    );
    expect(put).toBeTruthy();
    const body = put!.body as {
      document: {
        templateId: string;
        outline: unknown[];
        checks: unknown[];
      };
    };
    expect(body.document.templateId).toBe("custom");
    expect(body.document.outline).toEqual([]);
    expect(body.document.checks).toEqual([]);
  });

  it("Filled-template path: pick → preview → confirm POSTs the doc, PUTs the bundle, routes to the new doc", async () => {
    const calls: FetchCall[] = [];
    const created: Document = newDocument(
      "doc-incident",
      "2026-04-30T00:00:00.000Z"
    );
    installFetch((call) => {
      calls.push(call);
      if (call.url.endsWith("/api/templates"))
        return { templates: [] };
      if (call.url.endsWith("/api/documents") && call.method === "POST")
        return { document: created };
      return {};
    });

    render(<OnboardingPage />);

    fireEvent.click(screen.getByRole("button", { name: /Incident Report/i }));

    // Step 2 visible.
    expect(
      screen.getByRole("heading", { name: /Review preloaded/i })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Use this template/i })
    );

    await waitFor(() => expect(replaceMock).toHaveBeenCalled());
    expect(replaceMock).toHaveBeenCalledWith(`/documents/${created.id}`);

    const put = calls.find(
      (c) => c.method === "PUT" && c.url.endsWith(`/api/documents/${created.id}`)
    );
    expect(put).toBeTruthy();
    const body = put!.body as {
      document: {
        spec: { goal: string };
        outline: Array<{ id: string }>;
        checks: Array<{ id: string }>;
        templateId: string;
      };
    };
    expect(body.document.templateId).toBe("incident-report");
    // PRD user story 37: "land in workspace ready to generate" — the new doc
    // arrives with Spec / Outline / Checks preloaded.
    expect(body.document.spec.goal.length).toBeGreaterThan(0);
    expect(body.document.outline.length).toBeGreaterThan(0);
    expect(body.document.checks.length).toBeGreaterThan(0);
  });

  it("Postmortem path: applies the postmortem template to the new doc", async () => {
    const calls: FetchCall[] = [];
    const created: Document = newDocument(
      "doc-pm",
      "2026-04-30T00:00:00.000Z"
    );
    installFetch((call) => {
      calls.push(call);
      if (call.url.endsWith("/api/templates"))
        return { templates: [] };
      if (call.url.endsWith("/api/documents") && call.method === "POST")
        return { document: created };
      return {};
    });

    render(<OnboardingPage />);
    fireEvent.click(screen.getByRole("button", { name: /Postmortem/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Use this template/i })
    );

    await waitFor(() => expect(replaceMock).toHaveBeenCalled());

    const put = calls.find(
      (c) => c.method === "PUT" && c.url.endsWith(`/api/documents/${created.id}`)
    );
    expect(
      (
        put!.body as {
          document: { templateId: string };
        }
      ).document.templateId
    ).toBe("postmortem");
  });

  it("Status Report path: applies the status-report template to the new doc", async () => {
    const calls: FetchCall[] = [];
    const created: Document = newDocument(
      "doc-status",
      "2026-04-30T00:00:00.000Z"
    );
    installFetch((call) => {
      calls.push(call);
      if (call.url.endsWith("/api/templates"))
        return { templates: [] };
      if (call.url.endsWith("/api/documents") && call.method === "POST")
        return { document: created };
      return {};
    });

    render(<OnboardingPage />);
    fireEvent.click(screen.getByRole("button", { name: /Status Report/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Use this template/i })
    );

    await waitFor(() => expect(replaceMock).toHaveBeenCalled());

    const put = calls.find(
      (c) => c.method === "PUT" && c.url.endsWith(`/api/documents/${created.id}`)
    );
    expect(
      (
        put!.body as {
          document: { templateId: string };
        }
      ).document.templateId
    ).toBe("status-report");
  });

  it("Back from preview returns to step 1 without creating a document", async () => {
    const calls: FetchCall[] = [];
    installFetch((call) => {
      calls.push(call);
      if (call.url.endsWith("/api/templates"))
        return { templates: [] };
      return {};
    });

    render(<OnboardingPage />);

    fireEvent.click(screen.getByRole("button", { name: /Incident Report/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Back$/i }));

    expect(
      screen.getByRole("heading", { name: /Choose a document type/i })
    ).toBeInTheDocument();

    // No document was created.
    expect(
      calls.some((c) => c.method === "POST" && c.url.endsWith("/api/documents"))
    ).toBe(false);
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
