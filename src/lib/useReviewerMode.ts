"use client";

import { useState } from "react";

export const REVIEWER_QUERY_PARAM = "mode";
export const REVIEWER_QUERY_VALUE = "reviewer";

export function readReviewerModeFromURL(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get(REVIEWER_QUERY_PARAM) === REVIEWER_QUERY_VALUE;
}

// Reviewer mode is per-session for the mounted document. Initial value comes
// from the URL (?mode=reviewer). The setter flips state in-place but does NOT
// touch the URL — navigation away unmounts the workspace, so a fresh mount
// re-reads the URL and the in-session toggle does not persist (per issue 014:
// "the toggle does not persist across navigation").
export function useReviewerMode(): [boolean, (next: boolean) => void] {
  const [isReviewer, setIsReviewer] = useState<boolean>(() =>
    readReviewerModeFromURL()
  );
  return [isReviewer, setIsReviewer];
}
