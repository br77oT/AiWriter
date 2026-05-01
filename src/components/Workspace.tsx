"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Check,
  ChecksConfig,
  Document,
  OutlineSection,
  Spec,
  ValidationReport,
} from "@/lib/types";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { SpecPane } from "./panes/SpecPane";
import { OutlinePane } from "./panes/OutlinePane";
import { ChecksPane } from "./panes/ChecksPane";
import { DraftPane } from "./panes/DraftPane";
import { ValidationRail } from "./panes/ValidationRail";
import { getFixture } from "@/lib/validation/fixtures";

interface WorkspaceProps {
  document: Document;
}

const LAST_OPENED_KEY = "aiwriter:lastOpenedDocId";
const REVALIDATE_DEBOUNCE_MS = 600;

type ValidationStatus = "idle" | "running" | "error";
type GenerationStatus = "idle" | "running" | "error";

export function Workspace({ document: initial }: WorkspaceProps) {
  const [document, setDocument] = useState<Document>(initial);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [status, setStatus] = useState<ValidationStatus>("idle");
  const [genStatus, setGenStatus] = useState<GenerationStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track the latest validate request so a slow/old response can't
  // overwrite a newer one when typing fast.
  const requestSeqRef = useRef(0);

  useEffect(() => {
    try {
      window.localStorage.setItem(LAST_OPENED_KEY, document.id);
    } catch {
      // Private mode / disabled storage — degrade silently.
    }
  }, [document.id]);

  const runValidate = useCallback(async () => {
    const seq = ++requestSeqRef.current;
    setStatus("running");
    try {
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: document.id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { report: next } = (await res.json()) as {
        report: ValidationReport;
      };
      // Stale response — a newer request has been kicked off since.
      if (seq !== requestSeqRef.current) return;
      setReport(next);
      setStatus("idle");
    } catch {
      if (seq !== requestSeqRef.current) return;
      setStatus("error");
    }
  }, [document.id]);

  // Debounced re-run on draft mutations. Per the issue: "even though there's
  // no full draft editor yet, treat any draft mutation". The DraftPane
  // textareas are the mutation surface for slice 002; later slices add more.
  const scheduleRevalidate = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(runValidate, REVALIDATE_DEBOUNCE_MS);
  }, [runValidate]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const persistDocument = useCallback(
    async (next: Document) => {
      setDocument(next);
      await fetch(`/api/documents/${next.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document: {
            spec: next.spec,
            outline: next.outline,
            checks: next.checks,
            checksConfig: next.checksConfig,
            draftSections: next.draftSections,
            outlineFrozen: next.outlineFrozen,
          },
        }),
      });
    },
    []
  );

  const handleSpecChange = useCallback(
    (spec: Spec) => {
      void persistDocument({ ...document, spec });
    },
    [document, persistDocument]
  );

  const handleOutlineChange = useCallback(
    (outline: OutlineSection[]) => {
      void persistDocument({ ...document, outline });
      // Outline shape (sections present, required-flag) feeds the structural
      // evaluator — re-validate so the right rail reflects the change.
      scheduleRevalidate();
    },
    [document, persistDocument, scheduleRevalidate]
  );

  const handleFrozenChange = useCallback(
    (outlineFrozen: boolean) => {
      void persistDocument({ ...document, outlineFrozen });
    },
    [document, persistDocument]
  );

  const handleChecksChange = useCallback(
    (checks: Check[]) => {
      void persistDocument({ ...document, checks });
      // Question Evaluator reads from doc.checks — re-validate so the right
      // rail picks up added/removed/edited questions.
      scheduleRevalidate();
    },
    [document, persistDocument, scheduleRevalidate]
  );

  const handleChecksConfigChange = useCallback(
    (checksConfig: ChecksConfig) => {
      void persistDocument({ ...document, checksConfig });
    },
    [document, persistDocument]
  );

  const handleDraftSectionChange = useCallback(
    (outlineId: string, text: string) => {
      const next: Document = {
        ...document,
        draftSections: { ...document.draftSections, [outlineId]: text },
      };
      void persistDocument(next);
      scheduleRevalidate();
    },
    [document, persistDocument, scheduleRevalidate]
  );

  const handleGenerate = useCallback(async () => {
    setGenStatus("running");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: document.id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { document: next } = (await res.json()) as { document: Document };
      setDocument(next);
      setGenStatus("idle");
      // PRD §"Checks Module": when "Evaluate after every generation" is ON
      // (default), validate immediately so the rail flips to fresh statuses
      // without an extra Validate click.
      if (document.checksConfig.evaluateAfterEveryGeneration) {
        void runValidate();
      }
    } catch {
      setGenStatus("error");
    }
  }, [document.id, document.checksConfig.evaluateAfterEveryGeneration, runValidate]);

  const handleLoadFixture = useCallback(
    async (fixtureId: string) => {
      const fixture = getFixture(fixtureId);
      if (!fixture) return;
      const next: Document = {
        ...document,
        outline: fixture.outline,
        checks: fixture.checks,
        draftSections: fixture.draftSections,
      };
      await persistDocument(next);
      void runValidate();
    },
    [document, persistDocument, runValidate]
  );

  return (
    <div className="flex h-full flex-col">
      <TopBar
        documentTitle={document.title}
        validating={status === "running"}
        generating={genStatus === "running"}
        canGenerate={document.outline.length > 0}
        onValidate={runValidate}
        onGenerate={handleGenerate}
        onLoadFixture={handleLoadFixture}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeDocumentId={document.id} />
        <main className="grid flex-1 grid-cols-[260px_260px_260px_1fr] overflow-hidden">
          <SpecPane spec={document.spec} onSpecChange={handleSpecChange} />
          <OutlinePane
            outline={document.outline}
            outlineFrozen={document.outlineFrozen}
            onOutlineChange={handleOutlineChange}
            onFrozenChange={handleFrozenChange}
          />
          <ChecksPane
            checks={document.checks}
            checksConfig={document.checksConfig}
            onChecksChange={handleChecksChange}
            onChecksConfigChange={handleChecksConfigChange}
          />
          <DraftPane
            document={document}
            onDraftSectionChange={handleDraftSectionChange}
          />
        </main>
        <ValidationRail
          document={document}
          report={report}
          status={status}
        />
      </div>
    </div>
  );
}
