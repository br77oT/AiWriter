// Validation Engine — single deep-module interface per PRD §"Validation Engine".
//
//   validate(draft, outline, checks) → ValidationReport
//
// Internally split into a Structural Evaluator (pure, draft + outline → status
// per section) and a Question Evaluator (LLM-backed, one call per check).
// Stability: with a deterministic provider, identical inputs return identical
// reports. The real Anthropic provider is wired in slice 006; this slice
// freezes the interface and exercises it through `createScriptedProvider`.

import {
  type Check,
  type OutlineSection,
  type StructuralStatus,
  type QuestionStatus,
  type ValidationReport,
} from "../types";
import {
  type LlmProvider,
  type LlmRequest,
  getDefaultProvider,
} from "../llm";

// Below this word count a section that *has* content is reported as `thin`.
// The threshold is intentionally low — the goal is to flag stubs, not to
// police section length. Tune up if false positives appear in real drafts.
const THIN_WORD_COUNT = 25;

export interface ValidateOptions {
  provider?: LlmProvider;
}

export async function validate(
  draft: Record<string, string>,
  outline: OutlineSection[],
  checks: Check[],
  options: ValidateOptions = {}
): Promise<ValidationReport> {
  const provider = options.provider ?? getDefaultProvider();
  const structure = evaluateStructure(draft, outline);
  const questions = await evaluateQuestions(draft, outline, checks, provider);
  const coverageScore = computeCoverageScore(
    structure,
    questions,
    outline,
    checks
  );
  return { structure, questions, coverageScore };
}

// --- Structural Evaluator -----------------------------------------------

export function evaluateStructure(
  draft: Record<string, string>,
  outline: OutlineSection[]
): ValidationReport["structure"] {
  return outline.map((section) => {
    const text = (draft[section.id] ?? "").trim();
    if (text === "") {
      // Required + empty → missing. Optional + empty is reported as `thin`
      // with a clear note so the user knows it's a non-blocking gap.
      if (section.required) {
        return {
          outlineId: section.id,
          status: "missing" as StructuralStatus,
        };
      }
      return {
        outlineId: section.id,
        status: "thin" as StructuralStatus,
        note: "Optional section is empty.",
      };
    }
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount < THIN_WORD_COUNT) {
      return {
        outlineId: section.id,
        status: "thin" as StructuralStatus,
        note: `Section is brief (${wordCount} words).`,
      };
    }
    return { outlineId: section.id, status: "present" as StructuralStatus };
  });
}

// --- Question Evaluator -------------------------------------------------

interface RawCheckResponse {
  status?: string;
  evidence?: string | null;
  suggestion?: string | null;
}

async function evaluateQuestions(
  draft: Record<string, string>,
  outline: OutlineSection[],
  checks: Check[],
  provider: LlmProvider
): Promise<ValidationReport["questions"]> {
  if (checks.length === 0) return [];
  const draftText = renderDraftForLlm(draft, outline);
  const results: ValidationReport["questions"] = [];
  for (const check of checks) {
    const request = buildCheckRequest(draftText, check.question);
    let parsed: RawCheckResponse = {};
    try {
      const raw = await provider.complete(request);
      parsed = JSON.parse(raw) as RawCheckResponse;
    } catch {
      // Provider returned non-JSON. Treat as unevaluable → missing with a
      // generic suggestion so the report stays well-formed.
      parsed = {
        status: "missing",
        suggestion: "Evaluator returned an invalid response.",
      };
    }
    results.push(normalizeCheckResult(check.id, parsed));
  }
  return results;
}

function normalizeCheckResult(
  checkId: string,
  raw: RawCheckResponse
): ValidationReport["questions"][number] {
  const status = (raw.status ?? "missing").toLowerCase() as QuestionStatus;
  const evidence =
    typeof raw.evidence === "string" && raw.evidence.trim() !== ""
      ? raw.evidence.trim()
      : undefined;
  const suggestion =
    typeof raw.suggestion === "string" && raw.suggestion.trim() !== ""
      ? raw.suggestion.trim()
      : undefined;

  // PRD invariant: answered/partial MUST include evidence. If the LLM omits
  // it, downgrade to missing rather than serve a half-formed positive.
  if ((status === "answered" || status === "partial") && !evidence) {
    return {
      checkId,
      status: "missing",
      suggestion:
        suggestion ?? "Evaluator could not cite evidence; mark as missing.",
    };
  }

  // PRD invariant: partial/missing MUST include a suggestion.
  const needsSuggestion = status === "partial" || status === "missing";
  const finalSuggestion =
    needsSuggestion && !suggestion
      ? "Add a direct answer to this question."
      : suggestion;

  if (status === "answered") {
    return { checkId, status, evidence };
  }
  return {
    checkId,
    status: status === "partial" ? "partial" : "missing",
    evidence,
    suggestion: finalSuggestion,
  };
}

function buildCheckRequest(draftText: string, question: string): LlmRequest {
  return {
    systemPrompt: [
      "You are a document QA evaluator.",
      "Given a DRAFT and a QUESTION the draft is supposed to answer, decide:",
      '- "answered" — the draft answers the question directly,',
      '- "partial" — the draft addresses the question but misses key detail,',
      '- "missing" — the draft does not address the question.',
      "",
      'Respond with JSON only: {"status":"answered"|"partial"|"missing",',
      '"evidence":"<exact quoted span from the draft, or null if missing>",',
      '"suggestion":"<concrete suggestion to fix gaps, or null if answered>"}.',
      "Evidence is REQUIRED for answered and partial; suggestion is REQUIRED",
      "for partial and missing.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: `Question: ${question}\n\nDraft:\n${draftText}`,
      },
    ],
  };
}

function renderDraftForLlm(
  draft: Record<string, string>,
  outline: OutlineSection[]
): string {
  if (outline.length === 0) {
    // No outline — fall back to whatever sections exist in the draft.
    return Object.entries(draft)
      .map(([id, text]) => `## ${id}\n${text}`)
      .join("\n\n");
  }
  return outline
    .map((s) => `## ${s.heading}\n${(draft[s.id] ?? "").trim()}`)
    .join("\n\n");
}

// --- Coverage score -----------------------------------------------------

export function computeCoverageScore(
  structure: ValidationReport["structure"],
  questions: ValidationReport["questions"],
  outline: OutlineSection[],
  checks: Check[]
): ValidationReport["coverageScore"] {
  const requiredIds = new Set(
    outline.filter((s) => s.required).map((s) => s.id)
  );
  const requiredStructural = structure.filter((s) =>
    requiredIds.has(s.outlineId)
  );
  return {
    checksAnswered: questions.filter((q) => q.status === "answered").length,
    checksTotal: checks.length,
    sectionsPresent: requiredStructural.filter((s) => s.status === "present")
      .length,
    sectionsTotal: requiredIds.size,
  };
}
