"use client";

import { useMemo } from "react";
import type { Document, ValidationReport } from "@/lib/types";
import {
  exportMarkdown,
  exportPlainText,
  getBlockingFailures,
  suggestFilename,
} from "@/lib/export";

interface ExportPopoverProps {
  document: Document;
  report: ValidationReport | null;
  onClose: () => void;
}

// Popover with three export actions: download Markdown, download plain text,
// copy Markdown to clipboard. When `blockExportIfMissing` is ON and the
// validation report shows any failing check, all three are disabled and the
// failing check questions are listed inline so the user knows what to fix.
//
// The Workspace is responsible for ensuring `report` is fresh — it auto-runs
// validate before opening the popover when there's no current report.
export function ExportPopover({ document, report, onClose }: ExportPopoverProps) {
  const blocking = useMemo(
    () => getBlockingFailures(document.checks, document.checksConfig, report),
    [document.checks, document.checksConfig, report]
  );
  const blocked = blocking !== null;

  const exportDoc = useMemo(
    () => ({
      title: document.title,
      outline: document.outline,
      draftSections: document.draftSections,
    }),
    [document.title, document.outline, document.draftSections]
  );

  function handleDownloadMarkdown() {
    if (blocked) return;
    const md = exportMarkdown(exportDoc);
    triggerDownload(md, suggestFilename(document.title, "md"), "text/markdown");
  }

  function handleDownloadPlainText() {
    if (blocked) return;
    const txt = exportPlainText(exportDoc);
    triggerDownload(txt, suggestFilename(document.title, "txt"), "text/plain");
  }

  async function handleCopy() {
    if (blocked) return;
    const md = exportMarkdown(exportDoc);
    try {
      await navigator.clipboard.writeText(md);
    } catch {
      // Clipboard API unavailable — silently fail for V1; the download paths
      // remain a viable workaround.
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="export-popover-heading"
      className="absolute right-4 top-12 z-40 w-80 rounded border border-neutral-200 bg-white p-3 shadow-lg"
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 id="export-popover-heading" className="text-sm font-semibold">
          Export
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs hover:bg-neutral-100"
        >
          Close
        </button>
      </div>
      {blocked && (
        <div
          data-testid="export-blocked-notice"
          className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800"
        >
          <p className="mb-1 font-semibold">
            Export blocked — fix these checks first:
          </p>
          <ul className="list-disc space-y-0.5 pl-4">
            {blocking!.map((f) => (
              <li key={f.checkId}>
                {f.question}{" "}
                <span className="text-red-600">({f.status})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          disabled={blocked}
          onClick={handleDownloadMarkdown}
          className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-left text-sm hover:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
        >
          Download Markdown (.md)
        </button>
        <button
          type="button"
          disabled={blocked}
          onClick={handleDownloadPlainText}
          className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-left text-sm hover:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
        >
          Download Plain Text (.txt)
        </button>
        <button
          type="button"
          disabled={blocked}
          onClick={handleCopy}
          className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-left text-sm hover:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
        >
          Copy to Clipboard (Markdown)
        </button>
      </div>
    </div>
  );
}

// Build a Blob and click an anchor to download it. Lives in this component
// because the only browser-side path is the popover; if a second consumer ever
// needs it we'll lift to a util.
function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  // Some browsers require the anchor to be in the document.
  window.document.body.appendChild(anchor);
  anchor.click();
  window.document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
