import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ValidationRail } from "./ValidationRail";
import {
  newDocument,
  type Document,
  type ValidationReport,
} from "@/lib/types";

afterEach(() => cleanup());

function makeDoc(overrides: Partial<Document> = {}): Document {
  return {
    ...newDocument("doc-1", "2026-04-30T00:00:00.000Z"),
    outline: [
      { id: "summary", heading: "Summary", description: "", required: true },
      { id: "impact", heading: "Impact", description: "", required: true },
    ],
    checks: [{ id: "c1", question: "Who was affected?" }],
    ...overrides,
  };
}

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

const reportAllGreen: ValidationReport = {
  structure: [{ outlineId: "summary", status: "present" }],
  questions: [
    { checkId: "c1", status: "answered", evidence: "Floor 3 staff." },
  ],
  coverageScore: {
    checksAnswered: 1,
    checksTotal: 1,
    sectionsPresent: 1,
    sectionsTotal: 1,
  },
};

describe("ValidationRail — description", () => {
  it("shows a one-line explainer under the heading", () => {
    render(
      <ValidationRail
        document={makeDoc()}
        report={null}
        status="idle"
      />
    );
    expect(
      screen.getByTestId("validation-rail-description")
    ).toHaveTextContent(/how well the current draft meets the spec/i);
  });
});

describe("ValidationRail — numbered document checks", () => {
  it("prefixes each question with its 1-based ordinal", () => {
    const doc = {
      ...makeDoc(),
      checks: [
        { id: "c1", question: "Who was affected?" },
        { id: "c2", question: "What broke?" },
      ],
    };
    const report: ValidationReport = {
      structure: [],
      questions: [
        { checkId: "c1", status: "answered", evidence: "x" },
        { checkId: "c2", status: "missing", suggestion: "y" },
      ],
      coverageScore: {
        checksAnswered: 1,
        checksTotal: 2,
        sectionsPresent: 0,
        sectionsTotal: 0,
      },
    };
    render(<ValidationRail document={doc} report={report} status="idle" />);
    expect(screen.getByTestId("question-number-c1")).toHaveTextContent("1.");
    expect(screen.getByTestId("question-number-c2")).toHaveTextContent("2.");
  });
});

describe("ValidationRail — autofix footer (slice 008)", () => {
  it("renders both autofix buttons when a report is present and onAutofix is wired", () => {
    render(
      <ValidationRail
        document={makeDoc()}
        report={reportWithFailures}
        status="idle"
        onAutofix={() => {}}
      />
    );
    expect(
      screen.getByRole("button", { name: /Auto-fix missing items/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Regenerate only failed sections/ })
    ).toBeInTheDocument();
  });

  it("disables Auto-fix when no failing checks exist; structural button still enabled if structure has gaps", () => {
    const partialGreenChecks: ValidationReport = {
      structure: [{ outlineId: "impact", status: "thin" }],
      questions: [
        { checkId: "c1", status: "answered", evidence: "Some evidence." },
      ],
      coverageScore: {
        checksAnswered: 1,
        checksTotal: 1,
        sectionsPresent: 0,
        sectionsTotal: 1,
      },
    };
    render(
      <ValidationRail
        document={makeDoc()}
        report={partialGreenChecks}
        status="idle"
        onAutofix={() => {}}
      />
    );
    expect(
      screen.getByRole("button", { name: /Auto-fix missing items/ })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Regenerate only failed sections/ })
    ).toBeEnabled();
  });

  it("disables both buttons when the report is all-green", () => {
    render(
      <ValidationRail
        document={makeDoc()}
        report={reportAllGreen}
        status="idle"
        onAutofix={() => {}}
      />
    );
    expect(
      screen.getByRole("button", { name: /Auto-fix missing items/ })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Regenerate only failed sections/ })
    ).toBeDisabled();
  });

  it("does not render the autofix footer when onAutofix is not provided", () => {
    render(
      <ValidationRail
        document={makeDoc()}
        report={reportWithFailures}
        status="idle"
      />
    );
    expect(
      screen.queryByRole("button", { name: /Auto-fix missing items/ })
    ).not.toBeInTheDocument();
  });

  it("clicking each button calls onAutofix with the right mode", () => {
    const calls: string[] = [];
    render(
      <ValidationRail
        document={makeDoc()}
        report={reportWithFailures}
        status="idle"
        onAutofix={(mode) => calls.push(mode)}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Auto-fix missing items/ })
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Regenerate only failed sections/ })
    );
    expect(calls).toEqual(["questions", "structure"]);
  });

  it("disables both buttons and shows a Regenerating… status while busy", () => {
    render(
      <ValidationRail
        document={makeDoc()}
        report={reportWithFailures}
        status="idle"
        autofixBusy
        onAutofix={() => {}}
      />
    );
    expect(
      screen.getByRole("button", { name: /Auto-fix missing items/ })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Regenerate only failed sections/ })
    ).toBeDisabled();
    expect(screen.getByTestId("autofix-status")).toHaveTextContent(
      /Regenerating/i
    );
  });

  it("renders a locked-section notice naming each skipped section heading", () => {
    render(
      <ValidationRail
        document={makeDoc({ lockedSectionIds: ["impact"] })}
        report={reportWithFailures}
        status="idle"
        lockedSkipped={["impact"]}
        onAutofix={() => {}}
      />
    );
    const notice = screen.getByTestId("autofix-locked-notice");
    expect(notice).toHaveTextContent(/Impact/);
    expect(notice).toHaveTextContent(/locked/i);
  });
});

const reportWithEvaluatorError: ValidationReport = {
  structure: [{ outlineId: "summary", status: "present" }],
  questions: [
    {
      checkId: "c1",
      status: "error",
      suggestion: "This check couldn't be evaluated.",
    },
  ],
  coverageScore: {
    checksAnswered: 0,
    checksTotal: 1,
    sectionsPresent: 1,
    sectionsTotal: 1,
  },
};

describe("ValidationRail — evaluator errors", () => {
  it("labels an errored check 'Not evaluated', not 'Missing'", () => {
    render(
      <ValidationRail
        document={makeDoc()}
        report={reportWithEvaluatorError}
        status="idle"
      />
    );
    expect(screen.getByText("Not evaluated")).toBeInTheDocument();
    expect(screen.queryByText("Missing")).toBeNull();
  });

  it("shows an explanatory banner naming the likely cause", () => {
    render(
      <ValidationRail
        document={makeDoc()}
        report={reportWithEvaluatorError}
        status="idle"
      />
    );
    const notice = screen.getByTestId("evaluator-error-notice");
    expect(notice).toHaveTextContent(/could be evaluated/i);
    expect(notice).toHaveTextContent(/ANTHROPIC_API_KEY/);
    expect(notice).toHaveTextContent(/not assessed/i);
  });

  it("shows no banner when every check evaluated cleanly", () => {
    render(
      <ValidationRail
        document={makeDoc()}
        report={reportAllGreen}
        status="idle"
      />
    );
    expect(screen.queryByTestId("evaluator-error-notice")).toBeNull();
  });

  it("does not enable Auto-fix from evaluator errors alone", () => {
    render(
      <ValidationRail
        document={makeDoc()}
        report={reportWithEvaluatorError}
        status="idle"
        onAutofix={() => {}}
      />
    );
    expect(
      screen.getByRole("button", { name: /Auto-fix missing items/ })
    ).toBeDisabled();
  });
});
