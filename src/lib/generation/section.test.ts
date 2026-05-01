import { describe, it, expect } from "vitest";
import { generateSection } from "./index";
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
    id: "impact",
    heading: "Impact",
    description: "Operational impact",
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

const existingDraft: Record<string, string> = {
  summary: "The outage started at 03:15 UTC and lasted 42 minutes.",
  impact: "Search and checkout were unavailable for paid users.",
  actions: "On-call rotation needs a pager for storage outages.",
};

function targetHeading(req: LlmRequest): string | null {
  const userMsg = req.messages.find((m) => m.role === "user")?.content ?? "";
  const m = userMsg.match(/Rewrite the section "([^"]+)"|Expand the section "([^"]+)"/);
  return m?.[1] ?? m?.[2] ?? null;
}

describe("generateSection — rewrite mode", () => {
  it("returns text only for the target outlineId", async () => {
    const provider = createScriptedProvider(() => "Rewritten impact prose.");
    const text = await generateSection(spec, outline, checks, "impact", {
      mode: "rewrite",
      provider,
      existingDraft,
      instruction: "Add operational impact and which teams were blocked.",
    });
    expect(text).toBe("Rewritten impact prose.");
  });

  it("issues exactly one LLM call (no sibling regeneration)", async () => {
    let calls = 0;
    const provider = createScriptedProvider(() => {
      calls += 1;
      return "Rewritten.";
    });
    await generateSection(spec, outline, checks, "impact", {
      mode: "rewrite",
      provider,
      existingDraft,
      instruction: "tighten",
    });
    expect(calls).toBe(1);
  });

  it("includes the prior section text when preserveFacts is on (default)", async () => {
    let captured = "";
    const provider = createScriptedProvider((req) => {
      captured =
        req.systemPrompt + "\n" + req.messages.map((m) => m.content).join("\n");
      return "ok";
    });
    await generateSection(spec, outline, checks, "impact", {
      mode: "rewrite",
      provider,
      existingDraft,
      instruction: "tighten",
    });
    expect(captured).toContain(
      "Search and checkout were unavailable for paid users."
    );
  });

  it("does not feed sibling section text into the prompt", async () => {
    let captured = "";
    const provider = createScriptedProvider((req) => {
      captured =
        req.systemPrompt + "\n" + req.messages.map((m) => m.content).join("\n");
      return "ok";
    });
    const sibling: Record<string, string> = {
      summary: "SIBLING_SUMMARY_TOKEN",
      impact: "TARGET_IMPACT_TOKEN",
      actions: "SIBLING_ACTIONS_TOKEN",
    };
    await generateSection(spec, outline, checks, "impact", {
      mode: "rewrite",
      provider,
      existingDraft: sibling,
      instruction: "tighten",
    });
    expect(captured).toContain("TARGET_IMPACT_TOKEN");
    expect(captured).not.toContain("SIBLING_SUMMARY_TOKEN");
    expect(captured).not.toContain("SIBLING_ACTIONS_TOKEN");
  });

  it("forwards the user instruction into the prompt", async () => {
    let captured = "";
    const provider = createScriptedProvider((req) => {
      captured = req.messages.map((m) => m.content).join("\n");
      return "ok";
    });
    await generateSection(spec, outline, checks, "impact", {
      mode: "rewrite",
      provider,
      existingDraft,
      instruction: "Mention which teams were blocked.",
    });
    expect(captured).toContain("Mention which teams were blocked.");
  });

  it("instructs the model to preserve heading text when preserveHeading=true", async () => {
    let captured = "";
    const provider = createScriptedProvider((req) => {
      captured =
        req.systemPrompt + "\n" + req.messages.map((m) => m.content).join("\n");
      return "ok";
    });
    await generateSection(spec, outline, checks, "impact", {
      mode: "rewrite",
      provider,
      existingDraft,
      instruction: "tighten",
      preserve: {
        heading: true,
        facts: true,
        tone: true,
        otherSections: true,
      },
    });
    expect(captured).toMatch(/preserve.*heading/i);
    expect(captured).toMatch(/preserve.*fact/i);
    expect(captured).toMatch(/preserve.*tone/i);
  });

  it("rewriting target X never returns text for sibling Y (engine returns one string)", async () => {
    const provider = createScriptedProvider(() => "x");
    const result = await generateSection(spec, outline, checks, "impact", {
      mode: "rewrite",
      provider,
      existingDraft,
      instruction: "tighten",
    });
    // engine returns SectionText (a string) — there is no shape for sibling
    // edits at all. This is the structural guarantee referenced in
    // issue 007's "engine never returns sibling edits from a single-section call".
    expect(typeof result).toBe("string");
  });

  it("throws when outlineId is not found in the outline", async () => {
    const provider = createScriptedProvider(() => "x");
    await expect(
      generateSection(spec, outline, checks, "nope", {
        mode: "rewrite",
        provider,
        existingDraft,
        instruction: "tighten",
      })
    ).rejects.toThrow(/outline/i);
  });

  it("does not mutate spec, outline, checks, or existingDraft", async () => {
    const provider = createScriptedProvider(() => "ok");
    const specSnap = JSON.stringify(spec);
    const outlineSnap = JSON.stringify(outline);
    const checksSnap = JSON.stringify(checks);
    const draftSnap = JSON.stringify(existingDraft);
    await generateSection(spec, outline, checks, "impact", {
      mode: "rewrite",
      provider,
      existingDraft,
      instruction: "tighten",
    });
    expect(JSON.stringify(spec)).toBe(specSnap);
    expect(JSON.stringify(outline)).toBe(outlineSnap);
    expect(JSON.stringify(checks)).toBe(checksSnap);
    expect(JSON.stringify(existingDraft)).toBe(draftSnap);
  });
});

describe("generateSection — expand mode", () => {
  it("preserves heading and prior factual claims by default", async () => {
    let captured = "";
    const provider = createScriptedProvider((req) => {
      captured =
        req.systemPrompt + "\n" + req.messages.map((m) => m.content).join("\n");
      return "Expanded prose with more detail.";
    });
    const text = await generateSection(spec, outline, checks, "impact", {
      mode: "expand",
      provider,
      existingDraft,
      instruction: "Add more depth.",
    });
    // Heading + prior text + preserve directives must reach the model.
    expect(captured).toContain("Impact");
    expect(captured).toContain(
      "Search and checkout were unavailable for paid users."
    );
    expect(captured).toMatch(/preserve.*heading/i);
    expect(captured).toMatch(/preserve.*fact/i);
    expect(text).toBe("Expanded prose with more detail.");
  });

  it("uses an Expand framing in the user prompt", async () => {
    let captured = "";
    const provider = createScriptedProvider((req) => {
      captured = req.messages.map((m) => m.content).join("\n");
      return "ok";
    });
    await generateSection(spec, outline, checks, "impact", {
      mode: "expand",
      provider,
      existingDraft,
      instruction: "Add depth.",
    });
    expect(captured).toMatch(/Expand the section "Impact"/);
  });

  it("returns trimmed prose", async () => {
    const provider = createScriptedProvider(() => "   padded\n\n");
    const text = await generateSection(spec, outline, checks, "impact", {
      mode: "expand",
      provider,
      existingDraft,
    });
    expect(text).toBe("padded");
  });
});

describe("generateSection — golden prompt structure", () => {
  it("rewrite request mentions the target heading and instruction", async () => {
    const captured: LlmRequest[] = [];
    const provider = createScriptedProvider((req) => {
      captured.push(req);
      return "ok";
    });
    await generateSection(spec, outline, checks, "impact", {
      mode: "rewrite",
      provider,
      existingDraft,
      instruction: "tighten the prose",
    });
    expect(captured).toHaveLength(1);
    expect(targetHeading(captured[0])).toBe("Impact");
    const userMsg =
      captured[0].messages.find((m) => m.role === "user")?.content ?? "";
    expect(userMsg).toContain("tighten the prose");
  });

  it("forwards spec must-include / must-avoid into the prompt", async () => {
    let captured = "";
    const provider = createScriptedProvider((req) => {
      captured = req.messages.map((m) => m.content).join("\n");
      return "ok";
    });
    await generateSection(spec, outline, checks, "impact", {
      mode: "rewrite",
      provider,
      existingDraft,
      instruction: "tighten",
    });
    expect(captured).toContain("affected services");
    expect(captured).toContain("speculation about people");
  });
});
