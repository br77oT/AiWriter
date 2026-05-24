import { describe, it, expect } from "vitest";
import { formatRelativeTime } from "./relative-time";

const now = Date.parse("2026-05-24T12:00:00.000Z");

function ago(deltaMs: number): string {
  return formatRelativeTime(new Date(now - deltaMs).toISOString(), now);
}

describe("formatRelativeTime", () => {
  it("returns 'just now' for under 60 seconds", () => {
    expect(ago(0)).toBe("just now");
    expect(ago(30 * 1000)).toBe("just now");
    expect(ago(59 * 1000)).toBe("just now");
  });

  it("returns Xm ago for minutes", () => {
    expect(ago(2 * 60 * 1000)).toBe("2m ago");
    expect(ago(45 * 60 * 1000)).toBe("45m ago");
  });

  it("returns Xh ago for hours under a day", () => {
    expect(ago(2 * 60 * 60 * 1000)).toBe("2h ago");
    expect(ago(23 * 60 * 60 * 1000)).toBe("23h ago");
  });

  it("returns Xd ago for days under a week", () => {
    expect(ago(2 * 24 * 60 * 60 * 1000)).toBe("2d ago");
    expect(ago(6 * 24 * 60 * 60 * 1000)).toBe("6d ago");
  });

  it("returns Xw ago between a week and a month", () => {
    expect(ago(10 * 24 * 60 * 60 * 1000)).toBe("1w ago");
    expect(ago(21 * 24 * 60 * 60 * 1000)).toBe("3w ago");
  });

  it("returns a month/day stamp once older than 30 days, same year", () => {
    // 2026-05-24 minus 40 days = 2026-04-14
    expect(ago(40 * 24 * 60 * 60 * 1000)).toBe("Apr 14");
  });

  it("includes the year when it differs from the current year", () => {
    // 2026-05-24 minus 400 days = 2025-04-19
    expect(ago(400 * 24 * 60 * 60 * 1000)).toBe("Apr 19 2025");
  });

  it("returns '' for malformed timestamps", () => {
    expect(formatRelativeTime("not a date", now)).toBe("");
  });
});
