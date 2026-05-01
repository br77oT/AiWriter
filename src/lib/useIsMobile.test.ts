import { describe, it, expect, afterEach } from "vitest";
import { act, renderHook, cleanup } from "@testing-library/react";
import { useIsMobile, MOBILE_BREAKPOINT_PX } from "./useIsMobile";

function setViewportWidth(px: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: px,
  });
}

const originalWidth = window.innerWidth;

afterEach(() => {
  setViewportWidth(originalWidth);
  cleanup();
});

describe("useIsMobile", () => {
  it("returns false at the jsdom default viewport (>= breakpoint)", () => {
    setViewportWidth(1280);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("returns true when innerWidth is below the breakpoint", () => {
    setViewportWidth(800);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("flips when the viewport crosses the breakpoint via resize", () => {
    setViewportWidth(1280);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      setViewportWidth(600);
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBe(true);

    act(() => {
      setViewportWidth(1024);
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBe(false);
  });

  it("honors a custom breakpoint", () => {
    setViewportWidth(700);
    const { result } = renderHook(() => useIsMobile(600));
    expect(result.current).toBe(false);
  });

  it("the default breakpoint is 900px", () => {
    expect(MOBILE_BREAKPOINT_PX).toBe(900);

    setViewportWidth(899);
    const { result: r1 } = renderHook(() => useIsMobile());
    expect(r1.current).toBe(true);

    cleanup();
    setViewportWidth(900);
    const { result: r2 } = renderHook(() => useIsMobile());
    expect(r2.current).toBe(false);
  });
});
