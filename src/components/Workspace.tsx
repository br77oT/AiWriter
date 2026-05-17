"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { ValidationRail, type AutofixMode } from "./panes/ValidationRail";
import { SectionRewriteModal } from "./SectionRewriteModal";
import { TemplatePickerModal } from "./TemplatePickerModal";
import { VersionHistoryPanel } from "./VersionHistoryPanel";
import { ExportPopover } from "./ExportPopover";
import { LlmKeyWarning } from "./LlmKeyWarning";
import { ScenarioShareModal } from "./ScenarioShareModal";
import { MobileWorkspaceLayout } from "./MobileWorkspaceLayout";
import { WorkspaceGuide } from "./WorkspaceGuide";
import { useIsMobile } from "@/lib/useIsMobile";
import { useReviewerMode } from "@/lib/useReviewerMode";
import { getFixture } from "@/lib/validation/fixtures";
import type { PreserveFlags, SectionMode } from "@/lib/generation";
import {
  applyTemplate,
  bundleFromDocument,
  isDocumentEmpty,
  type Template,
} from "@/lib/templates";

interface WorkspaceProps {
  document: Document;
  // False when ANTHROPIC_API_KEY is not set — generation + validation run
  // against the echo stub. Defaults to true so tests opt in explicitly.
  llmConfigured?: boolean;
}

const LAST_OPENED_KEY = "aiwriter:lastOpenedDocId";
const COLLAPSED_PANES_KEY = "aiwriter:collapsedPanes";
const REVALIDATE_DEBOUNCE_MS = 600;

// The three left-hand panes the user can collapse to declutter the workspace.
// Draft and the validation rail are never collapsible — they're the focus.
type CollapsiblePaneId = "spec" | "outline" | "checks";
const COLLAPSIBLE_PANE_IDS: CollapsiblePaneId[] = ["spec", "outline", "checks"];

type ValidationStatus = "idle" | "running" | "error";
type GenerationStatus = "idle" | "running" | "error";
type AutofixStatus = "idle" | "running" | "error";

interface RewriteTarget {
  outlineId: string;
  heading: string;
  mode: SectionMode;
}

export function Workspace({
  document: initial,
  llmConfigured = true,
}: WorkspaceProps) {
  const [document, setDocument] = useState<Document>(initial);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [status, setStatus] = useState<ValidationStatus>("idle");
  const [genStatus, setGenStatus] = useState<GenerationStatus>("idle");
  const [rewriteTarget, setRewriteTarget] = useState<RewriteTarget | null>(
    null
  );
  const [rewriteBusy, setRewriteBusy] = useState(false);
  const [autofixStatus, setAutofixStatus] = useState<AutofixStatus>("idle");
  const [lockedSkipped, setLockedSkipped] = useState<string[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(
    null
  );
  const [exportOpen, setExportOpen] = useState(false);
  const [scenarioShareOpen, setScenarioShareOpen] = useState(false);
  const [scenarioBusy, setScenarioBusy] = useState(false);
  const [scenarioLink, setScenarioLink] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const router = useRouter();
  const [reviewerMode, setReviewerMode] = useReviewerMode();
  // Default to all three side panes collapsed so a fresh workspace opens
  // focused on the Draft. A saved localStorage preference overrides this.
  const [collapsedPanes, setCollapsedPanes] = useState<Set<CollapsiblePaneId>>(
    () => new Set(COLLAPSIBLE_PANE_IDS)
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards the scenario autorun pipeline so it fires at most once per mount.
  const autorunRef = useRef(false);

  // Reviewer-mode initial-paint: seed the rail with the latest validation
  // report captured on the document. PRD user story 39 calls for the rail
  // to render fully, but reviewers cannot click Validate (it's a mutating
  // action). Authors are unaffected — newDocument() carries no versions, so
  // this lookup returns undefined and the existing "click Validate" path
  // remains the cold-start behavior in author mode.
  useEffect(() => {
    if (!reviewerMode || report) return;
    const latest = [...document.versions]
      .reverse()
      .find((v) => v.validationReport !== null);
    if (latest && latest.validationReport) setReport(latest.validationReport);
  }, [reviewerMode, report, document.versions]);

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

  // Restore which panes the user collapsed last time. Hydrated in an effect
  // (not a lazy initializer) so the server render and first client render
  // agree — localStorage is client-only. With no saved preference the
  // all-collapsed default stands; any saved value (even an empty list, i.e.
  // the user expanded everything) is applied verbatim.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLLAPSED_PANES_KEY);
      if (raw === null) return;
      const ids = (JSON.parse(raw) as unknown[]).filter(
        (id): id is CollapsiblePaneId =>
          COLLAPSIBLE_PANE_IDS.includes(id as CollapsiblePaneId)
      );
      setCollapsedPanes(new Set(ids));
    } catch {
      // Corrupt / unavailable storage — keep the all-collapsed default.
    }
  }, []);

  const togglePaneCollapsed = useCallback((id: CollapsiblePaneId) => {
    setCollapsedPanes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(
          COLLAPSED_PANES_KEY,
          JSON.stringify([...next])
        );
      } catch {
        // Persisting is best-effort; the in-memory toggle still works.
      }
      return next;
    });
  }, []);

  // Templates list (built-ins + user-saved). Refreshes after a successful
  // Save-as-template so the new entry appears in the selector + sidebar.
  const refreshTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      const { templates: list } = (await res.json()) as {
        templates?: Template[];
      };
      setTemplates(list ?? []);
    } catch {
      // No templates → harmless degraded state; selector shows just the
      // empty placeholder.
    }
  }, []);

  useEffect(() => {
    void refreshTemplates();
  }, [refreshTemplates]);

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
      const { report: next, document: nextDoc } = (await res.json()) as {
        report: ValidationReport;
        // Slice 011: validate now snapshots a Version, so the route also
        // returns the updated document.
        document?: Document;
      };
      // Stale response — a newer request has been kicked off since.
      if (seq !== requestSeqRef.current) return;
      setReport(next);
      if (nextDoc) setDocument(nextDoc);
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
            lockedSectionIds: next.lockedSectionIds,
            templateId: next.templateId,
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

  const handleLockToggle = useCallback(
    (outlineId: string, locked: boolean) => {
      const without = document.lockedSectionIds.filter(
        (id) => id !== outlineId
      );
      const lockedSectionIds = locked ? [...without, outlineId] : without;
      void persistDocument({ ...document, lockedSectionIds });
    },
    [document, persistDocument]
  );

  const openRewriteModal = useCallback(
    (mode: SectionMode) => (outlineId: string) => {
      const section = document.outline.find((s) => s.id === outlineId);
      if (!section) return;
      setRewriteTarget({ outlineId, heading: section.heading, mode });
    },
    [document.outline]
  );

  const handleRewriteSubmit = useCallback(
    async (payload: { instruction: string; preserve: PreserveFlags }) => {
      if (!rewriteTarget) return;
      setRewriteBusy(true);
      try {
        const res = await fetch("/api/generate/section", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId: document.id,
            outlineId: rewriteTarget.outlineId,
            mode: rewriteTarget.mode,
            instruction: payload.instruction,
            preserve: payload.preserve,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { document: next } = (await res.json()) as { document: Document };
        setDocument(next);
        setRewriteTarget(null);
        if (document.checksConfig.evaluateAfterEveryGeneration) {
          void runValidate();
        }
      } catch {
        // Surface errors with the modal still open so the user can retry or
        // cancel; a future slice can render the error inline.
      } finally {
        setRewriteBusy(false);
      }
    },
    [
      document.id,
      document.checksConfig.evaluateAfterEveryGeneration,
      rewriteTarget,
      runValidate,
    ]
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

  const handleAutofix = useCallback(
    async (mode: AutofixMode) => {
      setAutofixStatus("running");
      try {
        const res = await fetch("/api/autofix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: document.id, mode }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { document: next, lockedSkipped: skipped } = (await res.json()) as {
          document: Document;
          lockedSkipped: string[];
        };
        setDocument(next);
        setLockedSkipped(skipped ?? []);
        setAutofixStatus("idle");
        // Re-validate so the rail flips statuses for the regenerated sections.
        // Slice 008 acceptance: "After either action, validation re-runs and
        // the rail updates." This is mode-independent — always run.
        void runValidate();
      } catch {
        setAutofixStatus("error");
      }
    },
    [document.id, runValidate]
  );

  // Picks a template from the dropdown / sidebar / picker modal. Confirms
  // before clobbering a non-empty document, per PRD §"Template Library":
  // "Selecting on an existing document is gated behind a confirm prompt to
  // avoid clobbering."
  const handleSelectTemplate = useCallback(
    (templateId: string) => {
      const template = templates.find((t) => t.id === templateId);
      if (!template) return;
      if (!isDocumentEmpty(document)) {
        const ok = window.confirm(
          `Loading "${template.name}" will replace the current Spec, Outline, and Checks. Continue?`
        );
        if (!ok) return;
      }
      const next = applyTemplate(document, template);
      void persistDocument(next);
      setPickerOpen(false);
      // Outline + checks changed → revalidate so the rail reflects the new
      // structural + question coverage immediately.
      scheduleRevalidate();
    },
    [document, persistDocument, scheduleRevalidate, templates]
  );

  const handleSaveAsTemplate = useCallback(async () => {
    const name = window.prompt("Name this template:");
    if (!name || !name.trim()) return;
    try {
      await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          bundle: bundleFromDocument(document),
        }),
      });
      await refreshTemplates();
    } catch {
      // No-op: surface a generic failure via the next refresh; the existing
      // doc state is unchanged.
    }
  }, [document, refreshTemplates]);

  const handleOpenPicker = useCallback(() => setPickerOpen(true), []);

  // "New document" guide step: route through the onboarding wizard, the same
  // entry point the sidebar's New-document button uses.
  const handleNewDocument = useCallback(() => {
    router.push("/onboarding");
  }, [router]);

  // "Write the draft" guide step: bring the first draft section into view and
  // focus it. The Draft pane is always rendered, so this is a scroll+focus
  // rather than a navigation.
  const handleWriteDraft = useCallback(() => {
    const firstTextarea = window.document.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label^="Draft text for"]'
    );
    firstTextarea?.scrollIntoView({ behavior: "smooth", block: "center" });
    firstTextarea?.focus();
  }, []);

  const handleOpenHistory = useCallback(() => setHistoryOpen(true), []);
  const handleCloseHistory = useCallback(() => setHistoryOpen(false), []);

  // PRD §user story 33: opening Export with no current report should run
  // validate first so the block-if-missing check has fresh data. Use the
  // current snapshot as the source of truth — a stale UI report shouldn't
  // unblock export when, say, the toggle was just flipped on.
  const handleOpenExport = useCallback(() => {
    if (!report) {
      void runValidate();
    }
    setExportOpen(true);
  }, [report, runValidate]);
  const handleCloseExport = useCallback(() => setExportOpen(false), []);

  // Freezes the current document into a shareable scenario and shows the
  // resulting `/scenario/<code>` link in a modal.
  const handleShareScenario = useCallback(async () => {
    setScenarioShareOpen(true);
    setScenarioBusy(true);
    setScenarioLink(null);
    try {
      const res = await fetch("/api/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: document.id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { code } = (await res.json()) as { code: string };
      setScenarioLink(`${window.location.origin}/scenario/${code}`);
    } catch {
      // Leave the link null — the modal renders a retry message.
      setScenarioLink(null);
    } finally {
      setScenarioBusy(false);
    }
  }, [document.id]);

  const handleCloseScenarioShare = useCallback(
    () => setScenarioShareOpen(false),
    []
  );

  const handleRestoreVersion = useCallback(
    async (versionId: string) => {
      setRestoringVersionId(versionId);
      try {
        const res = await fetch(
          `/api/documents/${document.id}/versions/${versionId}/restore`,
          { method: "POST" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { document: next } = (await res.json()) as { document: Document };
        setDocument(next);
        setHistoryOpen(false);
        // The restored draft may flip validation statuses — re-run so the rail
        // reflects the new state.
        void runValidate();
      } catch {
        // Surface failure passively for V1: the modal stays open and the user
        // can retry. A future polish pass could render an inline error.
      } finally {
        setRestoringVersionId(null);
      }
    },
    [document.id, runValidate]
  );

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

  // Scenario autorun: a `/scenario/<code>` link redirects here with
  // `?autorun=generate,validate`. Run those steps once, then drop the param
  // (history-only — no remount) so a refresh doesn't re-trigger the pipeline.
  useEffect(() => {
    if (autorunRef.current) return;
    autorunRef.current = true;
    if (typeof window === "undefined" || reviewerMode) return;
    const steps = new URLSearchParams(window.location.search).get("autorun");
    if (!steps) return;
    void (async () => {
      if (steps.includes("generate") && document.outline.length > 0) {
        await handleGenerate();
      }
      if (steps.includes("validate")) {
        await runValidate();
      }
    })();
    window.history.replaceState({}, "", `/documents/${document.id}`);
  }, [reviewerMode, document.id, document.outline.length, handleGenerate, runValidate]);

  const sidebar = (
    <Sidebar
      activeDocumentId={document.id}
      templates={templates}
      onSelectTemplate={handleSelectTemplate}
      compact={isMobile}
      readOnly={reviewerMode}
    />
  );
  // Collapse is a desktop-only affordance — the mobile layout already shows
  // one pane at a time via tabs, so it withholds the collapse props entirely.
  const specPane = (
    <SpecPane
      spec={document.spec}
      onSpecChange={handleSpecChange}
      readOnly={reviewerMode}
      collapsed={!isMobile && collapsedPanes.has("spec")}
      onToggleCollapse={
        isMobile ? undefined : () => togglePaneCollapsed("spec")
      }
    />
  );
  const outlinePane = (
    <OutlinePane
      outline={document.outline}
      outlineFrozen={document.outlineFrozen}
      onOutlineChange={handleOutlineChange}
      onFrozenChange={handleFrozenChange}
      readOnly={reviewerMode}
      collapsed={!isMobile && collapsedPanes.has("outline")}
      onToggleCollapse={
        isMobile ? undefined : () => togglePaneCollapsed("outline")
      }
    />
  );
  const checksPane = (
    <ChecksPane
      checks={document.checks}
      checksConfig={document.checksConfig}
      onChecksChange={handleChecksChange}
      onChecksConfigChange={handleChecksConfigChange}
      onLoadTemplate={handleOpenPicker}
      readOnly={reviewerMode}
      collapsed={!isMobile && collapsedPanes.has("checks")}
      onToggleCollapse={
        isMobile ? undefined : () => togglePaneCollapsed("checks")
      }
    />
  );
  const draftPane = (
    <DraftPane
      document={document}
      onDraftSectionChange={handleDraftSectionChange}
      onLockToggle={handleLockToggle}
      onRewrite={openRewriteModal("rewrite")}
      onExpand={openRewriteModal("expand")}
      readOnly={reviewerMode}
    />
  );
  const validationRail = (
    <ValidationRail
      document={document}
      report={report}
      status={status}
      autofixBusy={autofixStatus === "running"}
      lockedSkipped={lockedSkipped}
      // Hide the auto-fix footer in reviewer mode by withholding the handler.
      onAutofix={reviewerMode ? undefined : handleAutofix}
      compact={isMobile}
    />
  );

  return (
    <div className="flex h-full flex-col">
      <TopBar
        documentTitle={document.title}
        validating={status === "running"}
        generating={genStatus === "running"}
        canGenerate={document.outline.length > 0}
        canExport={hasAnyDraft(document)}
        templates={templates}
        selectedTemplateId={document.templateId}
        canSaveAsTemplate={!isDocumentEmpty(document)}
        versionCount={document.versions.length}
        reviewerMode={reviewerMode}
        onValidate={runValidate}
        onGenerate={handleGenerate}
        onLoadFixture={handleLoadFixture}
        onSelectTemplate={handleSelectTemplate}
        onSaveAsTemplate={handleSaveAsTemplate}
        onOpenHistory={handleOpenHistory}
        onOpenExport={handleOpenExport}
        onShareScenario={handleShareScenario}
        onToggleReviewerMode={setReviewerMode}
      />
      {!llmConfigured && <LlmKeyWarning />}
      {isMobile ? (
        <MobileWorkspaceLayout
          sidebar={sidebar}
          spec={specPane}
          outline={outlinePane}
          checks={checksPane}
          draft={draftPane}
          validation={validationRail}
        />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {sidebar}
          <main
            className="grid flex-1 overflow-hidden"
            style={{
              // Collapsed panes shrink to a thin strip; the freed width flows
              // to the Draft column (1fr), which is the actual writing surface.
              gridTemplateColumns: [
                collapsedPanes.has("spec") ? "2.5rem" : "260px",
                collapsedPanes.has("outline") ? "2.5rem" : "260px",
                collapsedPanes.has("checks") ? "2.5rem" : "260px",
                "1fr",
              ].join(" "),
            }}
          >
            {specPane}
            {outlinePane}
            {checksPane}
            {draftPane}
          </main>
          {validationRail}
        </div>
      )}
      {rewriteTarget && (
        <SectionRewriteModal
          sectionHeading={rewriteTarget.heading}
          mode={rewriteTarget.mode}
          busy={rewriteBusy}
          onCancel={() => setRewriteTarget(null)}
          onSubmit={handleRewriteSubmit}
        />
      )}
      {pickerOpen && (
        <TemplatePickerModal
          templates={templates}
          busy={false}
          onCancel={() => setPickerOpen(false)}
          onPick={handleSelectTemplate}
        />
      )}
      {historyOpen && (
        <VersionHistoryPanel
          document={document}
          busyVersionId={restoringVersionId}
          onClose={handleCloseHistory}
          onRestore={handleRestoreVersion}
          readOnly={reviewerMode}
        />
      )}
      {exportOpen && (
        <ExportPopover
          document={document}
          report={report}
          onClose={handleCloseExport}
        />
      )}
      {scenarioShareOpen && (
        <ScenarioShareModal
          url={scenarioLink}
          busy={scenarioBusy}
          onClose={handleCloseScenarioShare}
        />
      )}
      {/* Bottom-left mini-map of the workflow. Desktop + author mode only:
          mobile already paginates the panes via tabs, and reviewers aren't
          authoring a document through these stages. */}
      {!isMobile && !reviewerMode && (
        <WorkspaceGuide
          document={document}
          generating={genStatus === "running"}
          validating={status === "running"}
          canGenerate={document.outline.length > 0}
          onNewDocument={handleNewDocument}
          onSelectTemplate={handleOpenPicker}
          onWriteDraft={handleWriteDraft}
          onGenerate={handleGenerate}
          onValidate={runValidate}
        />
      )}
    </div>
  );
}

function hasAnyDraft(doc: Document): boolean {
  return Object.values(doc.draftSections).some(
    (text) => text && text.trim() !== ""
  );
}
