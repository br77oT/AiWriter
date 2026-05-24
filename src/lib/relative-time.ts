// Short relative-time label, e.g. "just now", "5m ago", "2h ago", "3d ago",
// "2w ago", or an absolute "Mar 14" / "Mar 14 2024" once it gets old enough.
//
// Tuned for terse list rows (sidebar) where vertical space is scarce — there
// is no "5 minutes ago" long form. Resolution caps at minutes (anything
// under 60s is "just now"); good enough for a "last edited" hint without
// suggesting we tick once per second.
export function formatRelativeTime(
  iso: string,
  nowMs: number = Date.now()
): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diffSec = Math.max(0, Math.round((nowMs - t) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffDay < 30) {
    const diffWk = Math.round(diffDay / 7);
    return `${diffWk}w ago`;
  }
  // Older than a month: show a month/day stamp. Add the year only when the
  // year differs from the current year, to keep recent-but-old entries short.
  const date = new Date(t);
  const now = new Date(nowMs);
  const month = date.toLocaleString("en", { month: "short" });
  const day = date.getDate();
  if (date.getFullYear() === now.getFullYear()) {
    return `${month} ${day}`;
  }
  return `${month} ${day} ${date.getFullYear()}`;
}
