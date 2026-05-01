"use client";

import { useMemo, useState } from "react";
import type { Document, Version } from "@/lib/types";
import {
  diffVersions,
  listVersionsNewestFirst,
  type SectionDiff,
} from "@/lib/versions";

interface VersionHistoryPanelProps {
  document: Document;
  onClose: () => void;
  onRestore: (versionId: string) => void;
  busyVersionId?: string | null;
}

type View =
  | { kind: "list" }
  | { kind: "single"; versionId: string }
  | { kind: "diff"; aId: string; bId: string };

// Modal-style overlay listing the document's version timeline. From the list
// view the user can:
//   - View one version's draft + report read-only.
//   - Pick exactly two versions and Compare to render a per-section diff.
//   - Restore from either the list row or the single-version detail.
//
// Versions are ordered newest-first so the list reads top-down for the most
// recent edit. The component is purely presentational — Workspace owns the
// POST that actually performs the restore.
export function VersionHistoryPanel({
  document,
  onClose,
  onRestore,
  busyVersionId,
}: VersionHistoryPanelProps) {
  const [view, setView] = useState<View>({ kind: "list" });
  const [selected, setSelected] = useState<string[]>([]);

  const sorted = useMemo(
    () => listVersionsNewestFirst(document.versions),
    [document.versions]
  );

  const headingFor = (outlineId: string) =>
    document.outline.find((s) => s.id === outlineId)?.heading ?? outlineId;

  function toggleSelected(id: string, checked: boolean) {
    setSelected((prev) =>
      checked ? [...prev.filter((x) => x !== id), id] : prev.filter((x) => x !== id)
    );
  }

  function openCompare() {
    if (selected.length !== 2) return;
    // Compare in chronological order so the diff reads "before → after".
    const [aId, bId] = sorted
      .filter((v) => selected.includes(v.id))
      .map((v) => v.id)
      .reverse();
    setView({ kind: "diff", aId, bId });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="version-history-heading"
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <h2
            id="version-history-heading"
            className="text-base font-semibold"
          >
            Version history
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100"
          >
            Close
          </button>
        </div>

        {view.kind === "list" && (
          <ListView
            versions={sorted}
            selected={selected}
            onToggleSelected={toggleSelected}
            onOpenSingle={(id) => setView({ kind: "single", versionId: id })}
            onCompare={openCompare}
            onRestore={onRestore}
            busyVersionId={busyVersionId}
          />
        )}

        {view.kind === "single" && (
          <SingleView
            version={sorted.find((v) => v.id === view.versionId)!}
            headingFor={headingFor}
            outlineOrder={document.outline.map((s) => s.id)}
            onBack={() => setView({ kind: "list" })}
            onRestore={() => onRestore(view.versionId)}
            busy={busyVersionId === view.versionId}
          />
        )}

        {view.kind === "diff" && (
          <DiffView
            a={sorted.find((v) => v.id === view.aId)!}
            b={sorted.find((v) => v.id === view.bId)!}
            headingFor={headingFor}
            onBack={() => setView({ kind: "list" })}
          />
        )}
      </div>
    </div>
  );
}

function ListView({
  versions,
  selected,
  onToggleSelected,
  onOpenSingle,
  onCompare,
  onRestore,
  busyVersionId,
}: {
  versions: Version[];
  selected: string[];
  onToggleSelected: (id: string, checked: boolean) => void;
  onOpenSingle: (id: string) => void;
  onCompare: () => void;
  onRestore: (id: string) => void;
  busyVersionId?: string | null;
}) {
  if (versions.length === 0) {
    return (
      <div className="p-6 text-sm text-neutral-500">
        No version history yet. Run Generate, Validate, Rewrite, or Auto-fix to
        record one.
      </div>
    );
  }
  return (
    <>
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 text-sm">
        <span className="text-neutral-500">
          Tick exactly two versions to compare them.
        </span>
        <button
          type="button"
          disabled={selected.length !== 2}
          onClick={onCompare}
          className="rounded border border-neutral-300 bg-white px-3 py-1 hover:bg-neutral-100 disabled:bg-neutral-100 disabled:text-neutral-400"
        >
          Compare
        </button>
      </div>
      <ul className="flex-1 divide-y divide-neutral-200 overflow-y-auto">
        {versions.map((v) => {
          const checked = selected.includes(v.id);
          const busy = busyVersionId === v.id;
          return (
            <li
              key={v.id}
              data-testid="version-row"
              data-version-id={v.id}
              className="flex items-center gap-3 px-4 py-3 text-sm"
            >
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  aria-label={`Select for compare: ${v.label}`}
                  checked={checked}
                  onChange={(e) => onToggleSelected(v.id, e.target.checked)}
                />
              </label>
              <div className="flex-1">
                <div className="font-medium text-neutral-800">{v.label}</div>
                <div className="text-xs text-neutral-500">
                  {formatTimestamp(v.timestamp)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenSingle(v.id)}
                className="rounded border border-neutral-300 bg-white px-3 py-1 hover:bg-neutral-100"
              >
                View
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onRestore(v.id)}
                className="rounded border border-neutral-300 bg-white px-3 py-1 hover:bg-neutral-100 disabled:bg-neutral-100 disabled:text-neutral-400"
              >
                {busy ? "Restoring…" : "Restore"}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function SingleView({
  version,
  headingFor,
  outlineOrder,
  onBack,
  onRestore,
  busy,
}: {
  version: Version;
  headingFor: (id: string) => string;
  outlineOrder: string[];
  onBack: () => void;
  onRestore: () => void;
  busy: boolean;
}) {
  // Render in outline order first, then anything left over (sections that
  // were in the version but no longer exist in the live outline). This keeps
  // the diff readable and makes pruned sections visible rather than hidden.
  const orderedIds = [
    ...outlineOrder.filter((id) => version.draftSections[id] !== undefined),
    ...Object.keys(version.draftSections).filter(
      (id) => !outlineOrder.includes(id)
    ),
  ];
  return (
    <>
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 text-sm">
        <button
          type="button"
          onClick={onBack}
          className="rounded border border-neutral-300 bg-white px-3 py-1 hover:bg-neutral-100"
        >
          ← Back
        </button>
        <span className="text-neutral-600">
          <span className="font-medium">{version.label}</span>{" "}
          <span className="text-xs text-neutral-500">
            · {formatTimestamp(version.timestamp)}
          </span>
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={onRestore}
          className="rounded border border-neutral-300 bg-white px-3 py-1 hover:bg-neutral-100 disabled:bg-neutral-100 disabled:text-neutral-400"
        >
          {busy ? "Restoring…" : "Restore this version"}
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {orderedIds.length === 0 && (
          <p className="text-sm text-neutral-500">
            No draft content captured at this version.
          </p>
        )}
        {orderedIds.map((id) => (
          <section key={id}>
            <h3 className="mb-1 text-sm font-semibold text-neutral-700">
              {headingFor(id)}
            </h3>
            <pre className="whitespace-pre-wrap rounded border border-neutral-200 bg-neutral-50 p-2 text-sm text-neutral-800">
              {version.draftSections[id]}
            </pre>
          </section>
        ))}
        {version.validationReport && (
          <section>
            <h3 className="mb-1 text-sm font-semibold text-neutral-700">
              Validation report
            </h3>
            <p className="text-xs text-neutral-600">
              Coverage:{" "}
              {version.validationReport.coverageScore.checksAnswered}/
              {version.validationReport.coverageScore.checksTotal} checks ·{" "}
              {version.validationReport.coverageScore.sectionsPresent}/
              {version.validationReport.coverageScore.sectionsTotal} sections
            </p>
          </section>
        )}
      </div>
    </>
  );
}

function DiffView({
  a,
  b,
  headingFor,
  onBack,
}: {
  a: Version;
  b: Version;
  headingFor: (id: string) => string;
  onBack: () => void;
}) {
  const diff = diffVersions(a, b);
  return (
    <>
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 text-sm">
        <button
          type="button"
          onClick={onBack}
          className="rounded border border-neutral-300 bg-white px-3 py-1 hover:bg-neutral-100"
        >
          ← Back
        </button>
        <span className="text-neutral-600">
          <span className="font-medium">{a.label}</span>{" "}
          <span className="text-neutral-400">→</span>{" "}
          <span className="font-medium">{b.label}</span>
        </span>
        <span aria-hidden className="w-12" />
      </div>
      <ul className="flex-1 divide-y divide-neutral-200 overflow-y-auto">
        {diff.map((row) => (
          <DiffRow key={row.outlineId} row={row} headingFor={headingFor} />
        ))}
      </ul>
    </>
  );
}

function DiffRow({
  row,
  headingFor,
}: {
  row: SectionDiff;
  headingFor: (id: string) => string;
}) {
  const tone =
    row.status === "added"
      ? "text-emerald-700"
      : row.status === "removed"
      ? "text-red-700"
      : row.status === "changed"
      ? "text-amber-700"
      : "text-neutral-500";
  return (
    <li
      className="px-4 py-3 text-sm"
      data-testid="diff-row"
      data-outline-id={row.outlineId}
    >
      <div className="mb-1 flex items-baseline justify-between">
        <h4 className="font-medium text-neutral-800">
          {headingFor(row.outlineId)}
        </h4>
        <span className={`text-xs font-medium uppercase ${tone}`}>
          {row.status}
        </span>
      </div>
      {row.status === "changed" && (
        <div className="grid grid-cols-2 gap-2">
          <pre className="whitespace-pre-wrap rounded border border-red-200 bg-red-50 p-2 text-xs text-red-900">
            {row.before}
          </pre>
          <pre className="whitespace-pre-wrap rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">
            {row.after}
          </pre>
        </div>
      )}
      {row.status === "added" && (
        <pre className="whitespace-pre-wrap rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">
          {row.after}
        </pre>
      )}
      {row.status === "removed" && (
        <pre className="whitespace-pre-wrap rounded border border-red-200 bg-red-50 p-2 text-xs text-red-900">
          {row.before}
        </pre>
      )}
    </li>
  );
}

function formatTimestamp(iso: string): string {
  // Render in the user's locale; tests assert on the label text rather than
  // the timestamp string, so the exact format isn't load-bearing.
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
