"use client";

import { useCallback, useState } from "react";

export const REVIEWER_QUERY_PARAM = "mode";
export const REVIEWER_QUERY_VALUE = "reviewer";

export function readReviewerModeFromURL(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get(REVIEWER_QUERY_PARAM) === REVIEWER_QUERY_VALUE;
}

// Reflects the current reviewer-mode state into the URL via history
// replaceState — the URL becomes the shareable source of truth. Uses
// replaceState (not pushState) so toggling doesn't litter the back stack.
function writeReviewerModeToURL(next: boolean) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (next) {
    url.searchParams.set(REVIEWER_QUERY_PARAM, REVIEWER_QUERY_VALUE);
  } else {
    url.searchParams.delete(REVIEWER_QUERY_PARAM);
  }
  window.history.replaceState({}, "", url.toString());
}

// Reviewer mode lives in the URL (?mode=reviewer) so it can be shared. The
// initial value comes from the URL; the setter flips state AND syncs the
// query param so copying the address bar shares the current mode.
export function useReviewerMode(): [boolean, (next: boolean) => void] {
  const [isReviewer, setIsReviewer] = useState<boolean>(() =>
    readReviewerModeFromURL()
  );
  const setAndSyncUrl = useCallback((next: boolean) => {
    setIsReviewer(next);
    writeReviewerModeToURL(next);
  }, []);
  return [isReviewer, setAndSyncUrl];
}
