"use client";

import { useEffect, useState } from "react";

interface EnterExitState {
  // Whether the element should currently exist in the DOM. Stays true through
  // the exit transition so the fade-out is visible, then flips false once
  // the duration has elapsed.
  mounted: boolean;
  // Whether the element should currently be in its "entered" visual state.
  // The CSS transition between false → true (or true → false) is what the
  // user sees as a fade / slide.
  entered: boolean;
}

// Drives a two-phase enter/exit transition for elements that conditionally
// render. Pattern:
//   - open=true  → mount immediately, flip `entered` true on the next frame
//                  (so the CSS transition runs from "out" to "in")
//   - open=false → flip `entered` false immediately, unmount after `durationMs`
//
// Callers render `{mounted && <X className={entered ? "in" : "out"} />}` and
// the duration must match the CSS transition duration for the exit fade-out
// to complete before unmount.
export function useEnterExit(
  open: boolean,
  durationMs: number = 150
): EnterExitState {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Two rAFs: the first lets the element mount with `entered=false`
      // styles applied; the second flips `entered=true` so the browser has
      // observed both states and runs the transition between them. A single
      // rAF is unreliable across browsers / React batching.
      let second = 0;
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setEntered(true));
      });
      return () => {
        cancelAnimationFrame(first);
        if (second) cancelAnimationFrame(second);
      };
    }
    setEntered(false);
    const t = setTimeout(() => setMounted(false), durationMs);
    return () => clearTimeout(t);
  }, [open, durationMs]);

  return { mounted, entered };
}
