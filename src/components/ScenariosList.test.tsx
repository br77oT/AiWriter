import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ScenariosList } from "./ScenariosList";
import type { ScenarioSummary } from "@/lib/scenario-store";

afterEach(() => cleanup());

const sample: ScenarioSummary[] = [
  {
    code: "abcd2345",
    title: "Outage report",
    sectionCount: 5,
    checkCount: 6,
    createdAt: "2026-05-10T00:00:00.000Z",
  },
];

describe("ScenariosList", () => {
  it("renders an empty state when there are no scenarios", () => {
    render(<ScenariosList scenarios={[]} />);
    expect(screen.getByTestId("scenarios-empty")).toBeInTheDocument();
  });

  it("renders a row per scenario with counts, an Open link and a Copy button", () => {
    render(<ScenariosList scenarios={sample} />);

    expect(screen.getByText("Outage report")).toBeInTheDocument();

    const open = screen.getByRole("link", { name: /Open Outage report/i });
    expect(open).toHaveAttribute("href", "/scenario/abcd2345");
    expect(open.closest("li")).toHaveTextContent("5 sections · 6 checks");

    expect(
      screen.getByRole("button", { name: /Copy link for Outage report/i })
    ).toBeInTheDocument();
  });
});
