import { describe, it, expect, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useReviewerMode,
  readReviewerModeFromURL,
} from "./useReviewerMode";

const ORIGINAL_URL = "http://localhost/";

afterEach(() => {
  window.history.replaceState({}, "", ORIGINAL_URL);
});

describe("readReviewerModeFromURL", () => {
  it("returns false when no mode query param is present", () => {
    window.history.replaceState({}, "", "/documents/abc");
    expect(readReviewerModeFromURL()).toBe(false);
  });

  it("returns true when ?mode=reviewer is present", () => {
    window.history.replaceState({}, "", "/documents/abc?mode=reviewer");
    expect(readReviewerModeFromURL()).toBe(true);
  });

  it("returns false for any other mode value", () => {
    window.history.replaceState({}, "", "/documents/abc?mode=editor");
    expect(readReviewerModeFromURL()).toBe(false);
  });

  it("returns true when ?mode=reviewer is mixed with other params", () => {
    window.history.replaceState({}, "", "/documents/abc?foo=bar&mode=reviewer");
    expect(readReviewerModeFromURL()).toBe(true);
  });
});

describe("useReviewerMode", () => {
  it("initial value is false when the URL has no reviewer param", () => {
    window.history.replaceState({}, "", "/documents/abc");
    const { result } = renderHook(() => useReviewerMode());
    expect(result.current[0]).toBe(false);
  });

  it("initial value is true when the URL has ?mode=reviewer", () => {
    window.history.replaceState({}, "", "/documents/abc?mode=reviewer");
    const { result } = renderHook(() => useReviewerMode());
    expect(result.current[0]).toBe(true);
  });

  it("the setter flips state on demand", () => {
    window.history.replaceState({}, "", "/documents/abc");
    const { result } = renderHook(() => useReviewerMode());
    expect(result.current[0]).toBe(false);

    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);

    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
  });
});
