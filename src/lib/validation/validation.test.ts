import { describe, it, expect } from "vitest";
import { validate, evaluateStructure, computeCoverageScore } from "./index";
import { createScriptedProvider } from "../llm";
import type { Check, OutlineSection } from "../types";

// A scripted provider that maps each check question to a canned JSON
// response, so tests can pin every Question Evaluator outcome.
function scriptedFromMap(map: Record<string, unknown>) {
  return createScriptedProvider((req) => {
    const userMsg =
      req.messages.find((m) => m.role === "user")?.content ?? "";
    for (const question of Object.keys(map)) {
      if (userMsg.includes(question)) {
        return JSON.stringify(map[question]);
      }
    }
    return JSON.stringify({ status: "missing", suggestion: "Add an answer." });
  });
}

const outline: OutlineSection[] = [
  { id: "summary", heading: "Summary", description: "", required: true },
  { id: "timeline", heading: "Timeline", description: "", required: true },
  { id: "actions", heading: "Follow-up Actions", description: "", required: true },
  { id: "appendix", heading: "Appendix", description: "", required: false },
];

const checks: Check[] = [
  { id: "c1", question: "What happened?" },
  { id: "c2", question: "Who was affected?" },
  { id: "c3", question: "What follow-up is open?" },
];

describe("Structural Evaluator", () => {
  it("returns present for a section with substantive content", () => {
    const draft = {
      summary: "At 14:32 a smoke event triggered evacuation. " +
        "The building was clear within 12 minutes and no injuries were reported. " +
        "Operations resumed at 15:45 once the fire department cleared the floor.",
    };
    const result = evaluateStructure(draft, [outline[0]]);
    expect(result).toEqual([{ outlineId: "summary", status: "present" }]);
  });

  it("returns missing for required sections with no content", () => {
    const result = evaluateStructure({}, [outline[2]]);
    expect(result[0].status).toBe("missing");
    expect(result[0].outlineId).toBe("actions");
  });

  it("returns thin for required sections that are very short", () => {
    const draft = { summary: "It happened." };
    const result = evaluateStructure(draft, [outline[0]]);
    expect(result[0].status).toBe("thin");
    expect(result[0].note).toBeTruthy();
  });

  it("never marks non-required sections as missing", () => {
    const result = evaluateStructure({}, [outline[3]]);
    expect(result[0].status).not.toBe("missing");
    expect(result[0].outlineId).toBe("appendix");
  });

  it("reports non-required sections in the report", () => {
    const result = evaluateStructure({}, outline);
    expect(result.map((s) => s.outlineId)).toContain("appendix");
  });
});

describe("Question Evaluator", () => {
  it("returns answered with evidence when the LLM says so", async () => {
    const provider = scriptedFromMap({
      "What happened?": {
        status: "answered",
        evidence: "At 14:32 a smoke event triggered evacuation.",
        suggestion: null,
      },
    });
    const report = await validate(
      { summary: "At 14:32 a smoke event triggered evacuation." },
      [outline[0]],
      [checks[0]],
      { provider }
    );
    expect(report.questions).toHaveLength(1);
    expect(report.questions[0]).toMatchObject({
      checkId: "c1",
      status: "answered",
      evidence: "At 14:32 a smoke event triggered evacuation.",
    });
  });

  it("includes evidence on partial and a suggestion", async () => {
    const provider = scriptedFromMap({
      "Who was affected?": {
        status: "partial",
        evidence: "staff on floor 3",
        suggestion: "Add exact roles and departments impacted.",
      },
    });
    const report = await validate(
      { summary: "staff on floor 3 were evacuated." },
      [outline[0]],
      [checks[1]],
      { provider }
    );
    expect(report.questions[0].status).toBe("partial");
    expect(report.questions[0].evidence).toBe("staff on floor 3");
    expect(report.questions[0].suggestion).toMatch(/roles/);
  });

  it("returns missing with a suggestion (no evidence required)", async () => {
    const provider = scriptedFromMap({
      "What follow-up is open?": {
        status: "missing",
        suggestion: "Insert unresolved action items and owners.",
      },
    });
    const report = await validate(
      { summary: "Stuff happened." },
      [outline[0]],
      [checks[2]],
      { provider }
    );
    expect(report.questions[0].status).toBe("missing");
    expect(report.questions[0].evidence).toBeUndefined();
    expect(report.questions[0].suggestion).toMatch(/action items/);
  });

  it("downgrades answered to missing if the LLM omits evidence", async () => {
    const provider = scriptedFromMap({
      "What happened?": {
        status: "answered",
        evidence: null,
        suggestion: "Be more specific.",
      },
    });
    const report = await validate(
      { summary: "Something." },
      [outline[0]],
      [checks[0]],
      { provider }
    );
    expect(report.questions[0].status).toBe("missing");
    expect(report.questions[0].evidence).toBeUndefined();
  });
});

describe("Question Evaluator — response parsing", () => {
  it("parses a response wrapped in a ```json code fence", async () => {
    const provider = createScriptedProvider(
      () =>
        '```json\n{"status":"answered","evidence":"At 14:32 a smoke event triggered evacuation."}\n```'
    );
    const report = await validate(
      { summary: "At 14:32 a smoke event triggered evacuation." },
      [outline[0]],
      [checks[0]],
      { provider }
    );
    expect(report.questions[0].status).toBe("answered");
    expect(report.questions[0].evidence).toBe(
      "At 14:32 a smoke event triggered evacuation."
    );
  });

  it("parses JSON embedded in surrounding prose", async () => {
    const provider = createScriptedProvider(
      () =>
        'Here is my evaluation:\n{"status":"missing","suggestion":"Add specifics."}\nHope that helps.'
    );
    const report = await validate(
      { summary: "Vague." },
      [outline[0]],
      [checks[0]],
      { provider }
    );
    expect(report.questions[0].status).toBe("missing");
    expect(report.questions[0].suggestion).toMatch(/specifics/);
  });
});

describe("Question Evaluator — evaluator failures", () => {
  it("reports error (not missing) when the evaluator returns non-JSON", async () => {
    const provider = createScriptedProvider(() => "Looks fine to me.");
    const report = await validate(
      { summary: "Some draft text." },
      [outline[0]],
      [checks[0]],
      { provider }
    );
    expect(report.questions[0].status).toBe("error");
    expect(report.questions[0].suggestion).toMatch(/couldn't be evaluated/i);
  });

  it("reports error when the evaluator throws", async () => {
    const provider = createScriptedProvider(() => {
      throw new Error("network down");
    });
    const report = await validate(
      { summary: "Some draft text." },
      [outline[0]],
      [checks[0]],
      { provider }
    );
    expect(report.questions[0].status).toBe("error");
  });

  it("reports error when the evaluator returns an unrecognised status", async () => {
    const provider = createScriptedProvider(() =>
      JSON.stringify({ status: "dunno", suggestion: "n/a" })
    );
    const report = await validate(
      { summary: "Some draft text." },
      [outline[0]],
      [checks[0]],
      { provider }
    );
    expect(report.questions[0].status).toBe("error");
  });

  it("does not count errored checks as answered in the coverage score", async () => {
    const provider = createScriptedProvider(() => "not json");
    const report = await validate(
      { summary: "Some draft text." },
      [outline[0]],
      [checks[0]],
      { provider }
    );
    expect(report.coverageScore.checksAnswered).toBe(0);
    expect(report.coverageScore.checksTotal).toBe(1);
  });
});

describe("Coverage score", () => {
  it("counts answered checks and present required sections", () => {
    const score = computeCoverageScore(
      [
        { outlineId: "a", status: "present" },
        { outlineId: "b", status: "thin" },
        { outlineId: "c", status: "missing" },
        { outlineId: "d", status: "thin" }, // optional
      ],
      [
        { checkId: "1", status: "answered" },
        { checkId: "2", status: "partial" },
        { checkId: "3", status: "missing" },
      ],
      [
        { id: "a", heading: "", description: "", required: true },
        { id: "b", heading: "", description: "", required: true },
        { id: "c", heading: "", description: "", required: true },
        { id: "d", heading: "", description: "", required: false },
      ],
      [
        { id: "1", question: "" },
        { id: "2", question: "" },
        { id: "3", question: "" },
      ]
    );

    expect(score).toEqual({
      checksAnswered: 1,
      checksTotal: 3,
      sectionsPresent: 1,
      sectionsTotal: 3,
    });
  });

  it("handles empty inputs without crashing", () => {
    const score = computeCoverageScore([], [], [], []);
    expect(score).toEqual({
      checksAnswered: 0,
      checksTotal: 0,
      sectionsPresent: 0,
      sectionsTotal: 0,
    });
  });
});

describe("validate() end-to-end", () => {
  it("returns identical reports on identical inputs (stability)", async () => {
    const provider = scriptedFromMap({
      "What happened?": {
        status: "answered",
        evidence: "Pipe burst.",
        suggestion: null,
      },
    });
    const draft = {
      summary: "Pipe burst at 03:15 in the basement, flooding 200 square feet.",
    };
    const r1 = await validate(draft, [outline[0]], [checks[0]], { provider });
    const r2 = await validate(draft, [outline[0]], [checks[0]], { provider });
    expect(r1).toEqual(r2);
  });

  it("handles empty draft + empty checks + empty outline", async () => {
    const report = await validate({}, [], []);
    expect(report).toEqual({
      structure: [],
      questions: [],
      coverageScore: {
        checksAnswered: 0,
        checksTotal: 0,
        sectionsPresent: 0,
        sectionsTotal: 0,
      },
    });
  });

  it("handles empty draft with a non-empty outline (all required missing)", async () => {
    const report = await validate({}, outline, []);
    const required = report.structure.filter(
      (s) => s.outlineId !== "appendix"
    );
    expect(required.every((s) => s.status === "missing")).toBe(true);
    expect(report.coverageScore.sectionsPresent).toBe(0);
    expect(report.coverageScore.sectionsTotal).toBe(3);
  });

  it("handles empty checks with a non-empty draft (no questions to evaluate)", async () => {
    const draft = {
      summary:
        "A long enough summary so that the structural status is reported as present, " +
        "without any check questions to ask the LLM.",
    };
    const report = await validate(draft, [outline[0]], []);
    expect(report.questions).toEqual([]);
    expect(report.coverageScore.checksTotal).toBe(0);
    expect(report.coverageScore.checksAnswered).toBe(0);
  });

  it("includes coverage score and structure + question lists in the report", async () => {
    const provider = scriptedFromMap({
      "What happened?": {
        status: "answered",
        evidence: "Pipe burst at 03:15.",
        suggestion: null,
      },
      "Who was affected?": {
        status: "missing",
        suggestion: "Name affected teams.",
      },
      "What follow-up is open?": {
        status: "partial",
        evidence: "Plumbing repair scheduled.",
        suggestion: "Add owners and dates.",
      },
    });
    const draft = {
      summary:
        "Pipe burst at 03:15 in the basement, flooding 200 square feet of " +
        "office space and shutting down two server racks for 90 minutes.",
      timeline:
        "03:15 burst detected. 03:18 facilities paged. 04:00 water shut off. " +
        "05:30 cleanup begins. 09:00 servers restored.",
    };
    const report = await validate(draft, outline, checks, { provider });

    expect(report.structure).toHaveLength(4);
    expect(report.questions).toHaveLength(3);
    expect(report.coverageScore.checksTotal).toBe(3);
    expect(report.coverageScore.checksAnswered).toBe(1);
    expect(report.coverageScore.sectionsTotal).toBe(3);
  });
});
