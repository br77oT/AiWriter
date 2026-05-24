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
  // Optional progress callback. Fires once per check question with the
  // wall-clock state of that LLM call — used by /api/validate to stream
  // per-check progress to the client UI. Structural evaluation runs in
  // microseconds and emits no events.
  onProgress?: (event: ValidateProgressEvent) => void;
}

// One-step progress event. `check-start` fires immediately before the
// per-question LLM call goes out; `check-done` fires immediately after the
// evaluator returns (success, JSON-parse failure, or thrown — `result`
// captures the normalized status either way).
export type ValidateProgressEvent =
  | {
      type: "check-start";
      index: number; // 0-based
      total: number;
      checkId: string;
      question: string;
    }
  | {
      type: "check-done";
      index: number;
      total: number;
      checkId: string;
      result: ValidationReport["questions"][number];
    };

export async function validate(
  draft: Record<string, string>,
  outline: OutlineSection[],
  checks: Check[],
  options: ValidateOptions = {}
): Promise<ValidationReport> {
  const provider = options.provider ?? getDefaultProvider();
  const structure = evaluateStructure(draft, outline);
  const questions = await evaluateQuestions(
    draft,
    outline,
    checks,
    provider,
    options.onProgress
  );
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

// The three statuses a healthy evaluator may return. Anything else — a throw,
// non-JSON output, or an unrecognised status string — becomes `error`.
const CONTENT_STATUSES = new Set(["answered", "partial", "missing"]);

// Shown for checks the evaluator could not assess. Deliberately does not blame
// the draft: the check simply wasn't run.
const EVALUATOR_ERROR_SUGGESTION =
  "This check couldn't be evaluated — the evaluator did not return a usable " +
  "response, so the draft was not assessed against it. Re-run Validate; if it " +
  "persists, the check evaluator (an AI model) is unavailable.";

// LLMs routinely wrap JSON in a ```json fence or add a sentence around it,
// even when asked for "JSON only". Pull the JSON payload out before parsing:
// a fenced block if present, otherwise the outermost {...} span.
function extractJson(raw: string): string {
  const text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1]!.trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) return text.slice(first, last + 1);
  return text;
}

async function evaluateQuestions(
  draft: Record<string, string>,
  outline: OutlineSection[],
  checks: Check[],
  provider: LlmProvider,
  onProgress?: (event: ValidateProgressEvent) => void
): Promise<ValidationReport["questions"]> {
  if (checks.length === 0) return [];
  const draftText = renderDraftForLlm(draft, outline);
  const results: ValidationReport["questions"] = [];
  for (let index = 0; index < checks.length; index += 1) {
    const check = checks[index]!;
    onProgress?.({
      type: "check-start",
      index,
      total: checks.length,
      checkId: check.id,
      question: check.question,
    });
    const request = buildCheckRequest(draftText, check.question);
    let result: ValidationReport["questions"][number];
    try {
      const { text } = await provider.complete(request);
      const parsed = JSON.parse(extractJson(text)) as RawCheckResponse;
      result = normalizeCheckResult(check.id, parsed);
    } catch {
      // The provider threw, or returned text that isn't JSON. The check was
      // never actually assessed — report `error` rather than disguising an
      // infrastructure failure as a "missing" content gap.
      result = {
        checkId: check.id,
        status: "error",
        suggestion: EVALUATOR_ERROR_SUGGESTION,
      };
    }
    results.push(result);
    onProgress?.({
      type: "check-done",
      index,
      total: checks.length,
      checkId: check.id,
      result,
    });
  }
  return results;
}

function normalizeCheckResult(
  checkId: string,
  raw: RawCheckResponse
): ValidationReport["questions"][number] {
  const status = (raw.status ?? "").toLowerCase();
  // The JSON parsed, but the model gave a status we don't recognise (or none
  // at all). The result is unusable — surface it as `error`, not `missing`.
  if (!CONTENT_STATUSES.has(status)) {
    return { checkId, status: "error", suggestion: EVALUATOR_ERROR_SUGGESTION };
  }
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
