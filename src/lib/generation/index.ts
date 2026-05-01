// Generation Engine — single deep-module interface per PRD §"Generation
// Engine". Slice 006 ships full-draft mode only.
//
//   generate(spec, outline, checks, options) → DraftSections
//
// Callers never construct prompt strings; all prompt orchestration lives
// behind this interface. Slice 007 will extend with rewrite/expand modes
// against the same engine boundary.
//
// Architectural invariants the engine enforces (verified by tests):
//
// - Source of truth is spec + outline + checks. The engine never reads
//   `existingDraft` text into its prompts in full-draft mode (PRD
//   §"Architectural decisions" → "Spec + Outline + Checks is the source of
//   truth, not the latest draft text"). `existingDraft` is taken so callers
//   can pass a current Document.draftSections in for future modes; in
//   full-draft mode it is intentionally ignored.
// - Spec, outline, and checks are inputs only — the engine never mutates
//   them (PRD §user story 40).
// - Locked section IDs are skipped — they are the caller's bit-identical
//   responsibility (PRD §"Lock semantics are hard"). Slice 007 layers the
//   per-section rewrite mode on top; slice 006 just honors the skip.
// - `outlineFrozen` is forwarded as a hint. In full-draft mode the engine
//   already only emits keys for the outline IDs it was given, so the flag
//   is a no-op here; it lands as a hard constraint in slice 007's
//   rewrite/expand modes.

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
}

export async function generate(
  spec: Spec,
  outline: OutlineSection[],
  checks: Check[],
  options: GenerateOptions = {}
): Promise<DraftSections> {
  const provider = options.provider ?? getDefaultProvider();
  const locked = new Set(options.lockedSectionIds ?? []);
  const targets = outline.filter((s) => !locked.has(s.id));

  const result: DraftSections = {};
  for (const section of targets) {
    const request = buildSectionRequest(spec, outline, checks, section);
    const raw = await provider.complete(request);
    result[section.id] = raw.trim();
  }
  return result;
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

  return parts.join("\n");
}

function renderList(items: string[]): string {
  if (items.length === 0) return "(none)";
  return items.map((s) => `"${s}"`).join(", ");
}
