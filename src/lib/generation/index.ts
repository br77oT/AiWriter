// Generation Engine — single deep-module interface per PRD §"Generation
// Engine". Slice 006 shipped full-draft mode; slice 007 added single-section
// rewrite + expand.
//
//   generate(spec, outline, checks, options) → DraftSections
//   generateSection(spec, outline, checks, outlineId, options) → string
//
// Callers never construct prompt strings; all prompt orchestration lives
// behind this interface.
//
// Architectural invariants the engine enforces (verified by tests):
//
// - Source of truth is spec + outline + checks. The engine never reads
//   `existingDraft` text into its prompts in full-draft mode (PRD
//   §"Architectural decisions" → "Spec + Outline + Checks is the source of
//   truth, not the latest draft text"). `existingDraft` is accepted so callers
//   can pass a current Document.draftSections in for rewrite/expand modes; in
//   full-draft mode it is intentionally ignored.
// - Spec, outline, and checks are inputs only — the engine never mutates
//   them (PRD §user story 40). The same applies to `existingDraft`.
// - Locked section IDs are skipped — they are the caller's bit-identical
//   responsibility (PRD §"Lock semantics are hard").
// - `outlineFrozen` is forwarded as a hint. In full-draft mode the engine
//   already only emits keys for the outline IDs it was given, so the flag
//   is a no-op there; in rewrite/expand modes the engine never returns
//   sibling edits at all (the return type is a single string), so the
//   "do not edit other sections" guarantee is structural rather than a
//   prompt directive.
// - generateSection only ever feeds the TARGET section's prior text into
//   the prompt. Sibling section text is never sent — that is what enforces
//   "rewriting one section never modifies sibling sections" at the engine
//   layer rather than relying on the model to behave.

import {
  type Check,
  type OutlineSection,
  type Spec,
} from "../types";
import {
  type LlmProvider,
  type LlmRequest,
  getDefaultProvider,
} from "../llm";

export type DraftSections = Record<string, string>;

// Per-section progress events emitted by `generate()` so the route /
// streaming consumer can update the UI as work happens. `total` is the
// full outline length (locked sections included) so the client can render
// a stable checklist that doesn't reshuffle when sections are skipped.
export type GenerateProgressEvent =
  | {
      type: "section-start";
      index: number;
      total: number;
      outlineId: string;
      heading: string;
    }
  | {
      type: "section-done";
      index: number;
      total: number;
      outlineId: string;
      heading: string;
      text: string;
    }
  | {
      type: "section-error";
      index: number;
      total: number;
      outlineId: string;
      heading: string;
      message: string;
    }
  | {
      type: "section-skipped";
      index: number;
      total: number;
      outlineId: string;
      heading: string;
      reason: "locked";
    };

export interface GenerateOptions {
  provider?: LlmProvider;
  // Section IDs that must NOT be regenerated. Engine returns no entry for
  // these IDs; the caller merges with the current draft to keep them
  // bit-identical.
  lockedSectionIds?: string[];
  // Forwarded for slice 007. In full-draft mode the engine already only
  // emits keys for the outline IDs it was given, so this is a no-op here.
  outlineFrozen?: boolean;
  // Accepted but intentionally not read in full-draft mode — see top-of-file
  // invariants. Slice 007's rewrite/expand modes will read it.
  existingDraft?: Record<string, string>;
  // Fires once per section in outline order. Awaitable so the route can
  // persist after every `section-done` before the next section starts.
  onProgress?: (event: GenerateProgressEvent) => void | Promise<void>;
}

export async function generate(
  spec: Spec,
  outline: OutlineSection[],
  checks: Check[],
  options: GenerateOptions = {}
): Promise<DraftSections> {
  const provider = options.provider ?? getDefaultProvider();
  const locked = new Set(options.lockedSectionIds ?? []);
  const total = outline.length;
  const result: DraftSections = {};

  for (let index = 0; index < outline.length; index++) {
    const section = outline[index];
    const common = {
      index,
      total,
      outlineId: section.id,
      heading: section.heading,
    };
    if (locked.has(section.id)) {
      await options.onProgress?.({
        type: "section-skipped",
        ...common,
        reason: "locked",
      });
      continue;
    }
    await options.onProgress?.({ type: "section-start", ...common });
    try {
      const request = buildSectionRequest(spec, outline, checks, section);
      const { text } = await provider.complete(request);
      const trimmed = text.trim();
      result[section.id] = trimmed;
      await options.onProgress?.({
        type: "section-done",
        ...common,
        text: trimmed,
      });
    } catch (err) {
      // Per ADR 0001: a single section's failure does not abort the run.
      // Emit a section-error event and move on. The caller (route) decides
      // what to persist (nothing for this section — the prior text stays).
      await options.onProgress?.({
        type: "section-error",
        ...common,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return result;
}

// --- Single-section rewrite / expand ------------------------------------

export type SectionMode = "rewrite" | "expand";

export interface PreserveFlags {
  heading: boolean;
  facts: boolean;
  tone: boolean;
  // Structurally guaranteed by the engine — generateSection returns a single
  // string, not a draft map, so it cannot return sibling edits regardless of
  // this flag. Carried so the modal can pass its UI state through verbatim
  // and so future engine variants (e.g. multi-section rewrite) have a place
  // to read it.
  otherSections: boolean;
}

export interface GenerateSectionOptions {
  mode: SectionMode;
  provider?: LlmProvider;
  // Map of outlineId → prior section text. Only the entry for the target
  // outlineId is read; sibling entries are never inserted into the prompt.
  existingDraft?: Record<string, string>;
  // User-supplied free text appended as an explicit instruction.
  instruction?: string;
  // Defaults: all true (matches the wireframe — "preserve" boxes ship
  // checked).
  preserve?: Partial<PreserveFlags>;
}

const DEFAULT_PRESERVE: PreserveFlags = {
  heading: true,
  facts: true,
  tone: true,
  otherSections: true,
};

export async function generateSection(
  spec: Spec,
  outline: OutlineSection[],
  checks: Check[],
  outlineId: string,
  options: GenerateSectionOptions
): Promise<string> {
  const target = outline.find((s) => s.id === outlineId);
  if (!target) {
    throw new Error(`outlineId not found in outline: ${outlineId}`);
  }
  const provider = options.provider ?? getDefaultProvider();
  const preserve: PreserveFlags = { ...DEFAULT_PRESERVE, ...options.preserve };
  const priorText = options.existingDraft?.[outlineId] ?? "";

  const request = buildSectionRewriteRequest(
    spec,
    outline,
    checks,
    target,
    options.mode,
    preserve,
    priorText,
    options.instruction ?? ""
  );
  const { text } = await provider.complete(request);
  return text.trim();
}

// --- Prompt construction ------------------------------------------------

function buildSectionRequest(
  spec: Spec,
  outline: OutlineSection[],
  checks: Check[],
  target: OutlineSection
): LlmRequest {
  return {
    systemPrompt: [
      "You are a structured document drafter.",
      "You will write ONE section of a longer document at a time.",
      "Output prose only — no Markdown headings, no leading title, no bullet lists unless the section is intrinsically a list.",
      "Honor the SPEC: must-include items must appear; must-avoid items must not.",
      "Match the requested tone and audience.",
      "Do not repeat the heading; the caller already renders it.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: renderUserPrompt(spec, outline, checks, target),
      },
    ],
  };
}

function renderUserPrompt(
  spec: Spec,
  outline: OutlineSection[],
  checks: Check[],
  target: OutlineSection
): string {
  const parts: string[] = [];

  parts.push("SPEC");
  parts.push(`Goal: ${spec.goal || "(unspecified)"}`);
  parts.push(`Tone: ${spec.tone || "(unspecified)"}`);
  parts.push(`Audience: ${spec.audience || "(unspecified)"}`);
  parts.push(`Must include: ${renderList(spec.mustInclude)}`);
  parts.push(`Must avoid: ${renderList(spec.mustAvoid)}`);
  parts.push("");

  parts.push("OUTLINE (full document structure)");
  if (outline.length === 0) {
    parts.push("(empty)");
  } else {
    outline.forEach((s, i) => {
      const flag = s.required ? "required" : "optional";
      const desc = s.description ? ` — ${s.description}` : "";
      parts.push(`${i + 1}. ${s.heading} [${flag}]${desc}`);
    });
  }
  parts.push("");

  parts.push("CHECKS (questions the document must answer)");
  if (checks.length === 0) {
    parts.push("(none)");
  } else {
    for (const c of checks) parts.push(`- ${c.question}`);
  }
  parts.push("");

  const flag = target.required ? "required" : "optional";
  const desc = target.description
    ? ` Description: ${target.description}.`
    : "";
  parts.push("TARGET");
  parts.push(
    `Write the section "${target.heading}" (id: ${target.id}, ${flag}).${desc}`
  );
  parts.push(
    "Output the prose for this section only — no heading, no surrounding sections."
  );
  const formatLine = renderFormatInstruction(target.format);
  if (formatLine) parts.push(formatLine);

  return parts.join("\n");
}

// Translate the optional structured `format` field on an OutlineSection into
// a precise instruction the drafter must follow. Defaults to no extra line
// (the system prompt's "prose unless intrinsically a list" carveout takes
// over). When set, this overrides that carveout with a hard requirement.
function renderFormatInstruction(format?: OutlineSection["format"]): string {
  if (!format || format === "prose") return "";
  if (format === "bullets") {
    return (
      "FORMAT: Output as a bulleted list. One item per line, each line " +
      'prefixed with "- ". No introductory paragraph; no trailing summary.'
    );
  }
  // numbered
  return (
    "FORMAT: Output as a numbered list. One item per line, each line " +
    'prefixed with the next ordinal ("1.", "2.", …). No introductory ' +
    "paragraph; no trailing summary."
  );
}

function renderList(items: string[]): string {
  if (items.length === 0) return "(none)";
  return items.map((s) => `"${s}"`).join(", ");
}

function buildSectionRewriteRequest(
  spec: Spec,
  outline: OutlineSection[],
  checks: Check[],
  target: OutlineSection,
  mode: SectionMode,
  preserve: PreserveFlags,
  priorText: string,
  instruction: string
): LlmRequest {
  const verb = mode === "expand" ? "Expand" : "Rewrite";

  const systemLines: string[] = [
    "You are a structured document drafter.",
    `You will ${verb.toLowerCase()} ONE section of a longer document.`,
    "Output prose only — no Markdown headings, no leading title, no bullet lists unless the section is intrinsically a list.",
    "Honor the SPEC: must-include items must appear; must-avoid items must not.",
    "Match the requested tone and audience.",
    "Do not repeat the heading; the caller already renders it.",
    "Output prose for the target section ONLY. Do not write or modify any other section.",
  ];
  if (preserve.heading) {
    systemLines.push("Preserve the section heading text exactly as given.");
  }
  if (preserve.facts && priorText) {
    systemLines.push(
      "Preserve every factual claim already present in the prior section text. You may rephrase, but do not drop, contradict, or invent facts."
    );
  }
  if (preserve.tone) {
    systemLines.push("Preserve the tone and style of the prior section text.");
  }

  return {
    systemPrompt: systemLines.join("\n"),
    messages: [
      {
        role: "user",
        content: renderSectionRewriteUserPrompt(
          spec,
          outline,
          checks,
          target,
          mode,
          priorText,
          instruction
        ),
      },
    ],
  };
}

function renderSectionRewriteUserPrompt(
  spec: Spec,
  outline: OutlineSection[],
  checks: Check[],
  target: OutlineSection,
  mode: SectionMode,
  priorText: string,
  instruction: string
): string {
  const parts: string[] = [];

  parts.push("SPEC");
  parts.push(`Goal: ${spec.goal || "(unspecified)"}`);
  parts.push(`Tone: ${spec.tone || "(unspecified)"}`);
  parts.push(`Audience: ${spec.audience || "(unspecified)"}`);
  parts.push(`Must include: ${renderList(spec.mustInclude)}`);
  parts.push(`Must avoid: ${renderList(spec.mustAvoid)}`);
  parts.push("");

  parts.push("OUTLINE (full document structure — context only)");
  if (outline.length === 0) {
    parts.push("(empty)");
  } else {
    outline.forEach((s, i) => {
      const flag = s.required ? "required" : "optional";
      const isTarget = s.id === target.id ? " ← TARGET" : "";
      parts.push(`${i + 1}. ${s.heading} [${flag}]${isTarget}`);
    });
  }
  parts.push("");

  parts.push("CHECKS (questions the document must answer)");
  if (checks.length === 0) {
    parts.push("(none)");
  } else {
    for (const c of checks) parts.push(`- ${c.question}`);
  }
  parts.push("");

  parts.push("CURRENT SECTION TEXT (target only)");
  parts.push(priorText.trim() === "" ? "(empty — no prior draft)" : priorText);
  parts.push("");

  const verb = mode === "expand" ? "Expand" : "Rewrite";
  const flag = target.required ? "required" : "optional";
  const desc = target.description
    ? ` Description: ${target.description}.`
    : "";
  parts.push("TARGET");
  parts.push(
    `${verb} the section "${target.heading}" (id: ${target.id}, ${flag}).${desc}`
  );

  if (instruction.trim() !== "") {
    parts.push("");
    parts.push("USER INSTRUCTION");
    parts.push(instruction.trim());
  }

  parts.push("");
  parts.push(
    "Output the prose for this section only — no heading, no surrounding sections."
  );
  const formatLine = renderFormatInstruction(target.format);
  if (formatLine) parts.push(formatLine);

  return parts.join("\n");
}
