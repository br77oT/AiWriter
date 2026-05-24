import { describe, it, expect } from "vitest";
import { generate } from "./index";
import { createScriptedProvider, type LlmRequest } from "../llm";
import type { Check, OutlineSection, Spec } from "../types";

const spec: Spec = {
  goal: "Document the outage on 2026-04-29.",
  tone: "concise, factual",
  audience: "engineering leadership",
  mustInclude: ["affected services", "duration"],
  mustAvoid: ["speculation about people"],
};

const outline: OutlineSection[] = [
  {
    id: "summary",
    heading: "Summary",
    description: "Short incident summary",
    required: true,
  },
  {
    id: "timeline",
    heading: "Timeline",
    description: "Sequence of events",
    required: true,
  },
  {
    id: "actions",
    heading: "Follow-up Actions",
    description: "",
    required: false,
  },
];

const checks: Check[] = [
  { id: "c1", question: "What happened?" },
  { id: "c2", question: "What follow-up is open?" },
];

// Pulls the target heading out of the user prompt — the engine commits to the
// `Write the section "<heading>"` shape, so this is the right seam to grip
// when scripting per-section responses in tests.
function targetHeading(req: LlmRequest): string | null {
  const userMsg = req.messages.find((m) => m.role === "user")?.content ?? "";
  const m = userMsg.match(/Write the section "([^"]+)"/);
  return m?.[1] ?? null;
}

function providerEchoingHeading() {
  return createScriptedProvider((req) => {
    const heading = targetHeading(req) ?? "Section";
    return `Generated content for ${heading}.`;
  });
}

describe("Generation Engine — full draft mode", () => {
  it("produces exactly one section per outline ID", async () => {
    const result = await generate(spec, outline, checks, {
      provider: providerEchoingHeading(),
    });

    expect(Object.keys(result).sort()).toEqual(
      ["actions", "summary", "timeline"].sort()
    );
    expect(result.summary).toMatch(/Summary/);
    expect(result.timeline).toMatch(/Timeline/);
    expect(result.actions).toMatch(/Follow-up Actions/);
  });

  it("emits a FORMAT instruction for bullets / numbered sections only", async () => {
    const captured: LlmRequest[] = [];
    const provider = createScriptedProvider((req) => {
      captured.push(req);
      return "ok";
    });
    const outlineWithFormat: OutlineSection[] = [
      {
        id: "summary",
        heading: "Summary",
        description: "",
        required: true,
        // No format → defaults to prose, no FORMAT line.
      },
      {
        id: "timeline",
        heading: "Timeline",
        description: "",
        required: true,
        format: "bullets",
      },
      {
        id: "actions",
        heading: "Actions",
        description: "",
        required: true,
        format: "numbered",
      },
    ];
    await generate(spec, outlineWithFormat, checks, { provider });

    const promptFor = (heading: string) =>
      captured.find((r) => targetHeading(r) === heading)
        ?.messages.find((m) => m.role === "user")?.content ?? "";

    expect(promptFor("Summary")).not.toMatch(/FORMAT:/);
    expect(promptFor("Timeline")).toMatch(/FORMAT: Output as a bulleted list/);
    expect(promptFor("Actions")).toMatch(/FORMAT: Output as a numbered list/);
  });

  it("returns prose only — no Markdown heading prefix", async () => {
    const provider = createScriptedProvider(
      () => "Plain prose without any heading."
    );
    const result = await generate(spec, [outline[0]], checks, { provider });
    expect(result.summary.startsWith("#")).toBe(false);
  });

  it("skips locked sections", async () => {
    const result = await generate(spec, outline, checks, {
      provider: providerEchoingHeading(),
      lockedSectionIds: ["timeline"],
    });
    expect(Object.keys(result).sort()).toEqual(
      ["actions", "summary"].sort()
    );
    expect(result.timeline).toBeUndefined();
  });

  it("never feeds previous draft text back into the LLM as primary input", async () => {
    let captured = "";
    const provider = createScriptedProvider((req) => {
      captured +=
        req.systemPrompt +
        "\n" +
        req.messages.map((m) => m.content).join("\n");
      return "ok";
    });
    const existingDraft = {
      summary: "PRIOR_DRAFT_TOKEN_SUMMARY",
      timeline: "PRIOR_DRAFT_TOKEN_TIMELINE",
    };
    await generate(spec, outline, checks, { provider, existingDraft });
    expect(captured).not.toContain("PRIOR_DRAFT_TOKEN_SUMMARY");
    expect(captured).not.toContain("PRIOR_DRAFT_TOKEN_TIMELINE");
  });

  it("respects a frozen outline — returned IDs match the input outline exactly", async () => {
    const result = await generate(spec, outline, checks, {
      provider: providerEchoingHeading(),
      outlineFrozen: true,
    });
    const returnedIds = Object.keys(result).sort();
    const outlineIds = outline.map((s) => s.id).sort();
    expect(returnedIds).toEqual(outlineIds);
  });

  it("does not mutate spec or outline", async () => {
    const specSnap = JSON.stringify(spec);
    const outlineSnap = JSON.stringify(outline);
    const checksSnap = JSON.stringify(checks);
    await generate(spec, outline, checks, {
      provider: providerEchoingHeading(),
    });
    expect(JSON.stringify(spec)).toBe(specSnap);
    expect(JSON.stringify(outline)).toBe(outlineSnap);
    expect(JSON.stringify(checks)).toBe(checksSnap);
  });

  it("returns an empty result for an empty outline", async () => {
    const result = await generate(spec, [], checks, {
      provider: providerEchoingHeading(),
    });
    expect(result).toEqual({});
  });

  it("returns identical results on identical inputs (stability)", async () => {
    const r1 = await generate(spec, outline, checks, {
      provider: providerEchoingHeading(),
    });
    const r2 = await generate(spec, outline, checks, {
      provider: providerEchoingHeading(),
    });
    expect(r1).toEqual(r2);
  });

  it("trims trailing whitespace from model output", async () => {
    const provider = createScriptedProvider(
      () => "   Some prose with stray padding.   \n\n"
    );
    const result = await generate(spec, [outline[0]], checks, { provider });
    expect(result.summary).toBe("Some prose with stray padding.");
  });
});

describe("Generation Engine — golden output (prompt structure)", () => {
  // These tests pin the *shape* of the prompt the engine sends to the LLM.
  // Per PRD §Further Notes "Risk: prompt drift": all prompt evolution lives
  // behind one interface, so a small set of golden tests on prompt structure
  // catches silent quality regressions when the prompt strings change.

  it("builds one request per outline section", async () => {
    const captured: LlmRequest[] = [];
    const provider = createScriptedProvider((req) => {
      captured.push(req);
      return "ok";
    });
    await generate(spec, outline, checks, { provider });
    expect(captured).toHaveLength(outline.length);
    expect(captured.map(targetHeading).sort()).toEqual(
      ["Follow-up Actions", "Summary", "Timeline"].sort()
    );
  });

  it("each request carries spec, full outline, checks, and the target section", async () => {
    const captured: LlmRequest[] = [];
    const provider = createScriptedProvider((req) => {
      captured.push(req);
      return "ok";
    });
    await generate(spec, [outline[0]], checks, { provider });

    expect(captured).toHaveLength(1);
    const [req] = captured;

    expect(req.systemPrompt).toMatch(/document/i);
    expect(req.systemPrompt).toMatch(/section/i);

    const userMsg = req.messages.find((m) => m.role === "user")?.content ?? "";
    expect(userMsg).toContain(spec.goal);
    expect(userMsg).toContain(spec.tone);
    expect(userMsg).toContain(spec.audience);
    expect(userMsg).toContain("affected services");
    expect(userMsg).toContain("duration");
    expect(userMsg).toContain("speculation about people");
    expect(userMsg).toContain("Summary");
    expect(userMsg).toContain("What happened?");
    expect(userMsg).toContain("What follow-up is open?");
    expect(userMsg).toMatch(/Write the section "Summary"/);
  });

  it("exposes the section description and required-flag for the target section", async () => {
    const captured: LlmRequest[] = [];
    const provider = createScriptedProvider((req) => {
      captured.push(req);
      return "ok";
    });
    await generate(spec, [outline[0]], checks, { provider });

    const userMsg = captured[0].messages.find((m) => m.role === "user")
      ?.content ?? "";
    expect(userMsg).toContain("Short incident summary");
    expect(userMsg).toMatch(/required/i);
  });
});
