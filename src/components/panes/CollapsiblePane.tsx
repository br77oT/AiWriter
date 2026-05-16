"use client";

// Shared chrome for the three left-hand panes (Spec / Outline / Checks).
// A pane in its collapsed state is replaced wholesale by CollapsedStrip — a
// thin full-height bar with the pane name set vertically. The header of an
// expanded pane carries a CollapseButton. Collapse is a pure view preference:
// it never touches document state, so it stays available in reviewer mode.

interface CollapsedStripProps {
  label: string;
  onExpand: () => void;
}

export function CollapsedStrip({ label, onExpand }: CollapsedStripProps) {
  return (
    <section
      className="h-full border-r border-neutral-200 bg-neutral-50"
      aria-label={`${label} pane (collapsed)`}
    >
      <button
        type="button"
        onClick={onExpand}
        aria-label={`Expand ${label} pane`}
        title={`Expand ${label}`}
        className="flex h-full w-full flex-col items-center gap-3 py-3 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
      >
        <span aria-hidden className="text-xs leading-none">
          »
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide [writing-mode:vertical-rl]">
          {label}
        </span>
      </button>
    </section>
  );
}

interface CollapseButtonProps {
  label: string;
  onCollapse: () => void;
}

export function CollapseButton({ label, onCollapse }: CollapseButtonProps) {
  return (
    <button
      type="button"
      onClick={onCollapse}
      aria-label={`Collapse ${label} pane`}
      title={`Collapse ${label}`}
      className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-xs leading-none text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
    >
      «
    </button>
  );
}
