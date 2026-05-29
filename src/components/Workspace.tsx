"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { AssembledDraftPane } from "./panes/AssembledDraftPane";
import { StatisticsPane } from "./panes/StatisticsPane";
import { ValidationRail, type AutofixMode } from "./panes/ValidationRail";
import { SectionRewriteModal } from "./SectionRewriteModal";
import { TemplatePickerModal } from "./TemplatePickerModal";
import { VersionHistoryPanel } from "./VersionHistoryPanel";
import { PromptInspectorPanel } from "./PromptInspectorPanel";
import { ExportPopover } from "./ExportPopover";
import { LlmKeyWarning } from "./LlmKeyWarning";
import { ScenarioShareModal } from "./ScenarioShareModal";
import {
  MobileWorkspaceLayout,
  type MobilePaneId,
} from "./MobileWorkspaceLayout";
import { WorkspaceGuide } from "./WorkspaceGuide";
import { useIsMobile } from "@/lib/useIsMobile";
import { useReviewerMode } from "@/lib/useReviewerMode";
import { getFixture } from "@/lib/validation/fixtures";
import type { LlmKeyStatus, PromptLog } from "@/lib/llm";
import type { PreserveFlags, SectionMode } from "@/lib/generation";
import {
  applyTemplate,
  bundleFromDocument,
  isDocumentEmpty,
  type Template,
} from "@/lib/templates";
import {
  incompleteRequiredSectionIds,
  requiredSectionsWithEmptyDraft,
} from "@/lib/outline";

interface WorkspaceProps {
  document: Document;
  // State of the configured LLM key. Defaults to "ok" so tests opt into the
  // warning explicitly.
  llmKeyStatus?: LlmKeyStatus;
}

const LAST_OPENED_KEY = "aiwriter:lastOpenedDocId";
const COLLAPSED_PANES_KEY = "aiwriter:collapsedPanes";
const PANEL_VISIBILITY_KEY = "aiwriter:panelVisibility";
const REVALIDATE_DEBOUNCE_MS = 600;

// Panes the user can collapse to declutter the workspace. Draft and the
// validation rail are never collapsible — they're the focus. "assembled"
// (the read-only stitched preview) is collapsed by default so the workspace
// stays focused on the editing surface until the user explicitly opens it.
// "sidebar" is the left-rail Documents list; collapsing it frees ~256px.
type CollapsiblePaneId =
  | "sidebar"
  | "spec"
  | "outline"
  | "checks"
  | "assembled"
  | "stats"
  | "validation";
const COLLAPSIBLE_PANE_IDS: CollapsiblePaneId[] = [
  "sidebar",
  "spec",
  "outline",
  "checks",
  "assembled",
  "stats",
  "validation",
];
// Ids that should be collapsed by default on first paint. The Validation
// rail stays expanded — it's the primary surface for reviewing a draft —
// while everything else opens collapsed to keep the workspace focused on
// Draft until the user explicitly opens a side pane.
const DEFAULT_COLLAPSED_PANE_IDS: CollapsiblePaneId[] = [
  "spec",
  "outline",
  "checks",
  "assembled",
  "stats",
];

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
  llmKeyStatus = { kind: "ok" },
}: WorkspaceProps) {
  const [document, setDocument] = useState<Document>(initial);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [status, setStatus] = useState<ValidationStatus>("idle");
  // Live per-check progress while validate is streaming. `null` between runs.
  const [validationProgress, setValidationProgress] = useState<
    { index: number; total: number; question: string } | null
  >(null);
  const [genStatus, setGenStatus] = useState<GenerationStatus>("idle");
  // Per-section progress for a streaming Generate run. `null` between runs.
  // The total comes from the first section-start so we don't pre-render an
  // empty checklist.
  const [generationProgress, setGenerationProgress] = useState<
    { index: number; total: number; heading: string } | null
  >(null);
  // Status for each section in the current run. Cleared at the start of
  // every run. Section ids that don't appear are "pending" by default.
  const [sectionStatuses, setSectionStatuses] = useState<
    Record<string, "writing" | "done" | "error" | "skipped">
  >({});
  // AbortController for the in-flight Generate fetch. Cancel fires
  // `.abort()`; the catch in handleGenerate distinguishes that from a real
  // error and keeps any already-applied section state.
  const generateAbortRef = useRef<AbortController | null>(null);
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
  // The prompt transcript from the most recent LLM action (Generate, Validate,
  // Rewrite/Expand, Auto-fix) and whether the inspector panel is open.
  const [promptLog, setPromptLog] = useState<PromptLog | null>(null);
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [scenarioShareOpen, setScenarioShareOpen] = useState(false);
  const [scenarioBusy, setScenarioBusy] = useState(false);
  const [scenarioLink, setScenarioLink] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const router = useRouter();
  const [reviewerMode, setReviewerMode] = useReviewerMode();
  // Default to all three side panes collapsed so a fresh workspace opens
  // focused on the Draft. A saved localStorage preference overrides this.
  const [collapsedPanes, setCollapsedPanes] = useState<Set<CollapsiblePaneId>>(
    () => new Set(DEFAULT_COLLAPSED_PANE_IDS)
  );
  // Group-level visibility toggles (TopBar buttons). Both default to hidden
  // so the workspace opens focused on the Draft; the toggles in the TopBar
  // reveal Spec/Outline/Checks ("Doc options") and ValidationRail/Stats
  // ("Validations"). Persisted to localStorage.
  const [docOptionsVisible, setDocOptionsVisible] = useState(false);
  const [validationsVisible, setValidationsVisible] = useState(false);
  // Imperative tab-switch request for MobileWorkspaceLayout: a target pane id
  // plus a nonce that increments on every request. A counter (not just an id)
  // lets repeat requests to the same tab still re-trigger the switch.
  const [mobileNavRequest, setMobileNavRequest] = useState<{
    pane: MobilePaneId;
    nonce: number;
  } | null>(null);
  // Which pane to render the floating 👉 pointer next to. Set when a TopBar
  // tagline link is clicked; auto-cleared by a useEffect after 3s.
  const [paneHighlight, setPaneHighlight] = useState<
    "spec" | "outline" | "assembled" | null
  >(null);
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

  // Mirror the document title into the browser window title so users with
  // many tabs can find the document at a glance. Re-runs on rename.
  useEffect(() => {
    const title = document.title?.trim() || "Untitled document";
    window.document.title = `${title} — AiWriter`;
  }, [document.title]);

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

  // Hydrate the two group-visibility toggles from localStorage on mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PANEL_VISIBILITY_KEY);
      if (raw === null) return;
      const parsed = JSON.parse(raw) as {
        docOptions?: boolean;
        validations?: boolean;
      };
      if (typeof parsed.docOptions === "boolean") {
        setDocOptionsVisible(parsed.docOptions);
      }
      if (typeof parsed.validations === "boolean") {
        setValidationsVisible(parsed.validations);
      }
    } catch {
      // Corrupt / unavailable storage — keep the hidden defaults.
    }
  }, []);

  const persistPanelVisibility = useCallback(
    (next: { docOptions: boolean; validations: boolean }) => {
      try {
        window.localStorage.setItem(PANEL_VISIBILITY_KEY, JSON.stringify(next));
      } catch {
        // Best-effort persistence; in-memory state remains correct.
      }
    },
    []
  );

  const handleToggleDocOptions = useCallback(() => {
    setDocOptionsVisible((prev) => {
      const next = !prev;
      persistPanelVisibility({
        docOptions: next,
        validations: validationsVisible,
      });
      return next;
    });
  }, [persistPanelVisibility, validationsVisible]);

  const handleToggleValidations = useCallback(() => {
    setValidationsVisible((prev) => {
      const next = !prev;
      persistPanelVisibility({
        docOptions: docOptionsVisible,
        validations: next,
      });
      return next;
    });
  }, [persistPanelVisibility, docOptionsVisible]);

  const requestMobileNav = useCallback((pane: MobilePaneId) => {
    setMobileNavRequest((prev) => ({ pane, nonce: (prev?.nonce ?? 0) + 1 }));
  }, []);

  // Auto-clear the pointer hint a few seconds after it's set so the 👉
  // doesn't linger forever.
  useEffect(() => {
    if (paneHighlight === null) return;
    const t = setTimeout(() => setPaneHighlight(null), 3000);
    return () => clearTimeout(t);
  }, [paneHighlight]);

  // Expand a previously-collapsed pane (no-op if it isn't collapsed) and
  // persist. Shared by the cross-pane navigation handlers below.
  const expandPane = useCallback((id: CollapsiblePaneId) => {
    setCollapsedPanes((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      try {
        window.localStorage.setItem(
          COLLAPSED_PANES_KEY,
          JSON.stringify([...next])
        );
      } catch {
        // Best-effort persistence.
      }
      return next;
    });
  }, []);

  // "Edit prompts" button in the Draft pane: reveal the Doc-options group
  // (so Outline becomes visible), expand the Outline pane if collapsed, then
  // focus the first heading input. On mobile, also flip the active tab.
  const handleEditPrompts = useCallback(() => {
    setDocOptionsVisible(true);
    persistPanelVisibility({ docOptions: true, validations: validationsVisible });
    expandPane("outline");
    requestMobileNav("outline");
    // Wait for the layout to render the now-visible pane before focusing.
    setTimeout(() => {
      const target = window.document.querySelector<HTMLInputElement>(
        'input[aria-label^="Heading for section"]'
      );
      target?.focus();
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }, [persistPanelVisibility, validationsVisible, expandPane, requestMobileNav]);

  // "Check validations" button in the Assembled Draft pane: reveal the
  // Validations group (rail + Statistics) and expand both if previously
  // collapsed. On mobile, also flip the active tab to the Validation rail.
  const handleCheckValidations = useCallback(() => {
    setValidationsVisible(true);
    persistPanelVisibility({ docOptions: docOptionsVisible, validations: true });
    expandPane("validation");
    expandPane("stats");
    requestMobileNav("validation");
  }, [persistPanelVisibility, docOptionsVisible, expandPane, requestMobileNav]);

  // Tagline "spec" / "outline" / "structured draft" link handlers. Each:
  // reveals the right group (if hidden), expands the pane, switches the
  // mobile tab, and sets the 👉 hint near that pane.
  const handleOpenSpec = useCallback(() => {
    setDocOptionsVisible(true);
    persistPanelVisibility({ docOptions: true, validations: validationsVisible });
    expandPane("spec");
    requestMobileNav("spec");
    setPaneHighlight("spec");
  }, [persistPanelVisibility, validationsVisible, expandPane, requestMobileNav]);

  const handleOpenOutline = useCallback(() => {
    setDocOptionsVisible(true);
    persistPanelVisibility({ docOptions: true, validations: validationsVisible });
    expandPane("outline");
    requestMobileNav("outline");
    setPaneHighlight("outline");
  }, [persistPanelVisibility, validationsVisible, expandPane, requestMobileNav]);

  const handleOpenStructured = useCallback(() => {
    expandPane("assembled");
    requestMobileNav("assembled");
    setPaneHighlight("assembled");
  }, [expandPane, requestMobileNav]);

  // "Simplified view" button: hide both Doc-options and Validations groups
  // in one click so the user sees just Draft + Structured draft. Persisted.
  const handleSimplifiedView = useCallback(() => {
    setDocOptionsVisible(false);
    setValidationsVisible(false);
    persistPanelVisibility({ docOptions: false, validations: false });
  }, [persistPanelVisibility]);

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
    setValidationProgress(null);
    try {
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: document.id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // The route streams NDJSON: one event per line, progress + final done.
      // Read chunks, split on "\n", parse each. Final event is `done`.
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let buffer = "";
      let finalDone: {
        report: ValidationReport;
        document?: Document;
        promptLog?: PromptLog;
      } | null = null;
      let streamError: string | null = null;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.trim() === "") continue;
          const event = JSON.parse(line) as
            | {
                type: "check-start";
                index: number;
                total: number;
                checkId: string;
                question: string;
              }
            | {
                type: "check-done";
                index: number;
                total: number;
                checkId: string;
                result: ValidationReport["questions"][number];
              }
            | {
                type: "done";
                report: ValidationReport;
                document?: Document;
                promptLog?: PromptLog;
              }
            | { type: "error"; message: string };
          // Stale stream — a newer validate has started; drop these events.
          if (seq !== requestSeqRef.current) continue;
          if (event.type === "check-start") {
            setValidationProgress({
              index: event.index,
              total: event.total,
              question: event.question,
            });
          } else if (event.type === "done") {
            finalDone = {
              report: event.report,
              document: event.document,
              promptLog: event.promptLog,
            };
          } else if (event.type === "error") {
            streamError = event.message;
          }
          // check-done events are informational — the final 'done' carries
          // the consolidated report; no per-check state to mutate here.
        }
      }
      if (seq !== requestSeqRef.current) return;
      if (streamError || !finalDone) {
        throw new Error(streamError ?? "Stream ended without a 'done' event");
      }
      setReport(finalDone.report);
      if (finalDone.document) setDocument(finalDone.document);
      if (finalDone.promptLog) setPromptLog(finalDone.promptLog);
      setStatus("idle");
      setValidationProgress(null);
    } catch {
      if (seq !== requestSeqRef.current) return;
      setStatus("error");
      setValidationProgress(null);
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
            title: next.title,
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
        const { document: next, promptLog: log } = (await res.json()) as {
          document: Document;
          promptLog?: PromptLog;
        };
        setDocument(next);
        if (log) setPromptLog(log);
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
    // Per ADR 0001: /api/generate streams NDJSON per-section events. We read
    // the body chunk-by-chunk, fill the document's draftSections as each
    // section-done lands, and let the final 'done' event swap in the
    // version-stamped document.
    const controller = new AbortController();
    generateAbortRef.current = controller;
    setGenStatus("running");
    setGenerationProgress(null);
    setSectionStatuses({});
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: document.id }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let buffer = "";
      let finalDone: {
        document: Document;
        promptLog?: PromptLog;
      } | null = null;
      let streamError: string | null = null;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.trim() === "") continue;
          const event = JSON.parse(line) as
            | {
                type: "section-start";
                index: number;
                total: number;
                outlineId: string;
                heading: string;
              }
            | {
                type: "section-done";
                index: number;
                total: number;
                outlineId: string;
                heading: string;
                text: string;
              }
            | {
                type: "section-error";
                index: number;
                total: number;
                outlineId: string;
                heading: string;
                message: string;
              }
            | {
                type: "section-skipped";
                index: number;
                total: number;
                outlineId: string;
                heading: string;
                reason: "locked";
              }
            | {
                type: "done";
                document: Document;
                draftSections: Record<string, string>;
                promptLog?: PromptLog;
              }
            | { type: "error"; message: string };
          if (event.type === "section-start") {
            setGenerationProgress({
              index: event.index,
              total: event.total,
              heading: event.heading,
            });
            setSectionStatuses((prev) => ({
              ...prev,
              [event.outlineId]: "writing",
            }));
          } else if (event.type === "section-done") {
            setSectionStatuses((prev) => ({
              ...prev,
              [event.outlineId]: "done",
            }));
            // Mirror the server's incremental persistence into local React
            // state so the textarea fills as soon as the event arrives.
            setDocument((prev) => ({
              ...prev,
              draftSections: {
                ...prev.draftSections,
                [event.outlineId]: event.text,
              },
            }));
          } else if (event.type === "section-error") {
            setSectionStatuses((prev) => ({
              ...prev,
              [event.outlineId]: "error",
            }));
          } else if (event.type === "section-skipped") {
            setSectionStatuses((prev) => ({
              ...prev,
              [event.outlineId]: "skipped",
            }));
          } else if (event.type === "done") {
            finalDone = {
              document: event.document,
              promptLog: event.promptLog,
            };
          } else if (event.type === "error") {
            streamError = event.message;
          }
        }
      }
      if (streamError || !finalDone) {
        throw new Error(streamError ?? "Stream ended without a 'done' event");
      }
      setDocument(finalDone.document);
      if (finalDone.promptLog) setPromptLog(finalDone.promptLog);
      setGenStatus("idle");
      setGenerationProgress(null);
      generateAbortRef.current = null;
      // PRD §"Checks Module": when "Evaluate after every generation" is ON
      // (default), validate immediately so the rail flips to fresh statuses
      // without an extra Validate click.
      if (document.checksConfig.evaluateAfterEveryGeneration) {
        void runValidate();
      }
    } catch (err) {
      // User cancellation surfaces here as an AbortError. Per ADR 0001 we
      // keep all already-applied section state (the textareas the user saw
      // fill in stay filled) — just clean up the in-flight UI bookkeeping.
      if (controller.signal.aborted) {
        setGenStatus("idle");
        setGenerationProgress(null);
        generateAbortRef.current = null;
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      console.error("Generate failed:", message);
      setGenStatus("error");
      setGenerationProgress(null);
      generateAbortRef.current = null;
    }
  }, [document.id, document.checksConfig.evaluateAfterEveryGeneration, runValidate]);

  const handleCancelGenerate = useCallback(() => {
    generateAbortRef.current?.abort();
  }, []);

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
        const {
          document: next,
          lockedSkipped: skipped,
          promptLog: log,
        } = (await res.json()) as {
          document: Document;
          lockedSkipped: string[];
          promptLog?: PromptLog;
        };
        setDocument(next);
        setLockedSkipped(skipped ?? []);
        if (log) setPromptLog(log);
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

  // Picks a template from the dropdown / sidebar / picker modal. Creates a
  // *new* document with the template applied, then navigates to it. Previously
  // this overwrote the current document with a confirm prompt; users found
  // that surprising — "Load template" reads as "use this template", not
  // "throw away my draft." The current document stays untouched in the
  // sidebar's Recent drafts list.
  const handleSelectTemplate = useCallback(
    async (templateId: string) => {
      const template = templates.find((t) => t.id === templateId);
      if (!template) return;
      try {
        const created = await fetch("/api/documents", { method: "POST" });
        if (!created.ok) return;
        const { document: newDoc } = (await created.json()) as {
          document: Document;
        };
        const next = applyTemplate(newDoc, template);
        await fetch(`/api/documents/${newDoc.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document: {
              spec: next.spec,
              outline: next.outline,
              checks: next.checks,
              draftSections: next.draftSections,
              lockedSectionIds: next.lockedSectionIds,
              outlineFrozen: next.outlineFrozen,
              templateId: next.templateId,
            },
          }),
        });
        setPickerOpen(false);
        router.push(`/documents/${newDoc.id}`);
      } catch {
        // Network blip — leave the user on the current doc. The picker can
        // be reopened to retry; no destructive change happened to the
        // existing document.
      }
    },
    [router, templates]
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

  // Inline rename from the TopBar. Title is persisted by the same PUT path
  // used for every other Document field.
  const handleRenameDocument = useCallback(
    (nextTitle: string) => {
      if (nextTitle === document.title) return;
      void persistDocument({ ...document, title: nextTitle });
    },
    [document, persistDocument]
  );

  // Delete the whole document; on success route to onboarding so the user
  // lands on a sane next-step screen instead of a stale workspace.
  const handleDeleteDocument = useCallback(async () => {
    const res = await fetch(`/api/documents/${document.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      window.alert("Could not delete the document. Try again.");
      return;
    }
    router.push("/onboarding");
  }, [document.id, router]);

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

  const handleOpenPrompts = useCallback(() => setPromptsOpen(true), []);
  const handleClosePrompts = useCallback(() => setPromptsOpen(false), []);

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

  // Generate-readiness: needs at least one outline section, every Required
  // section must have a heading, AND every Required section's draft textarea
  // must have user-provided text. The two indicator sets stay separate so
  // the Draft pane can hint at the right fix ("Heading required" → go to
  // Outline; "Fill in to generate" → type in the textarea right there).
  const incompleteRequiredIds = incompleteRequiredSectionIds(document.outline);
  const requiredEmptyDraftIds = requiredSectionsWithEmptyDraft(
    document.outline,
    document.draftSections
  );
  const canGenerate =
    document.outline.length > 0 &&
    incompleteRequiredIds.length === 0 &&
    requiredEmptyDraftIds.length === 0;

  const sidebar = (
    <Sidebar
      activeDocumentId={document.id}
      templates={templates}
      onSelectTemplate={handleSelectTemplate}
      compact={isMobile}
      readOnly={reviewerMode}
      collapsed={!isMobile && collapsedPanes.has("sidebar")}
      onToggleCollapse={
        isMobile ? undefined : () => togglePaneCollapsed("sidebar")
      }
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
      onSaveAsTemplate={reviewerMode ? undefined : handleSaveAsTemplate}
      canSaveAsTemplate={!isDocumentEmpty(document)}
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
      onGenerate={reviewerMode ? undefined : handleGenerate}
      generating={genStatus === "running"}
      canGenerate={canGenerate}
      readOnly={reviewerMode}
      onEditPrompts={reviewerMode ? undefined : handleEditPrompts}
      incompleteRequiredIds={incompleteRequiredIds}
      requiredEmptyDraftIds={requiredEmptyDraftIds}
      generationProgress={generationProgress}
      sectionStatuses={sectionStatuses}
      onCancelGenerate={
        reviewerMode || genStatus !== "running"
          ? undefined
          : handleCancelGenerate
      }
    />
  );
  const assembledDraftPane = (
    <AssembledDraftPane
      document={document}
      collapsed={!isMobile && collapsedPanes.has("assembled")}
      onToggleCollapse={
        isMobile ? undefined : () => togglePaneCollapsed("assembled")
      }
      onCheckValidations={reviewerMode ? undefined : handleCheckValidations}
    />
  );
  const statisticsPane = (
    <StatisticsPane
      document={document}
      collapsed={!isMobile && collapsedPanes.has("stats")}
      onToggleCollapse={
        isMobile ? undefined : () => togglePaneCollapsed("stats")
      }
    />
  );
  const validationRail = (
    <ValidationRail
      document={document}
      report={report}
      status={status}
      progress={validationProgress}
      autofixBusy={autofixStatus === "running"}
      lockedSkipped={lockedSkipped}
      // Hide the auto-fix footer in reviewer mode by withholding the handler.
      onAutofix={reviewerMode ? undefined : handleAutofix}
      compact={isMobile}
      collapsed={!isMobile && collapsedPanes.has("validation")}
      onToggleCollapse={
        isMobile ? undefined : () => togglePaneCollapsed("validation")
      }
    />
  );

  return (
    <div className="flex h-full flex-col">
      <TopBar
        document={document}
        documentTitle={document.title}
        validating={status === "running"}
        generating={genStatus === "running"}
        canGenerate={canGenerate}
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
        onOpenPrompts={handleOpenPrompts}
        hasPromptLog={promptLog !== null}
        onOpenExport={handleOpenExport}
        onShareScenario={handleShareScenario}
        onToggleReviewerMode={setReviewerMode}
        onNewDocument={handleNewDocument}
        onOpenTemplatePicker={handleOpenPicker}
        onWriteDraft={handleWriteDraft}
        onRenameDocument={handleRenameDocument}
        onDeleteDocument={handleDeleteDocument}
        docOptionsVisible={docOptionsVisible}
        validationsVisible={validationsVisible}
        onToggleDocOptions={handleToggleDocOptions}
        onToggleValidations={handleToggleValidations}
        onOpenSpec={handleOpenSpec}
        onOpenOutline={handleOpenOutline}
        onOpenStructured={handleOpenStructured}
        onSimplifiedView={handleSimplifiedView}
      />
      {llmKeyStatus && llmKeyStatus.kind !== "ok" && (
        <LlmKeyWarning status={llmKeyStatus} />
      )}
      {isMobile ? (
        <MobileWorkspaceLayout
          sidebar={sidebar}
          spec={specPane}
          outline={outlinePane}
          checks={checksPane}
          draft={draftPane}
          assembled={assembledDraftPane}
          stats={statisticsPane}
          validation={validationRail}
          docOptionsVisible={docOptionsVisible}
          validationsVisible={validationsVisible}
          requestedActivePane={mobileNavRequest?.pane}
          requestedActivePaneNonce={mobileNavRequest?.nonce}
        />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {sidebar}
          <main
            className="grid flex-1 overflow-hidden"
            style={{
              // Collapsed panes shrink to a thin strip; hidden panes (via the
              // TopBar "Doc options" toggle) are removed from the grid entirely.
              // Freed width flows to Draft (1fr); when Assembled is expanded it
              // takes 1fr too, so Draft and Assembled share 50/50.
              gridTemplateColumns: [
                ...(docOptionsVisible
                  ? [
                      collapsedPanes.has("spec") ? "2.5rem" : "260px",
                      collapsedPanes.has("outline") ? "2.5rem" : "340px",
                      collapsedPanes.has("checks") ? "2.5rem" : "260px",
                    ]
                  : []),
                "1fr",
                collapsedPanes.has("assembled") ? "2.5rem" : "1fr",
              ].join(" "),
            }}
          >
            {docOptionsVisible && specPane}
            {docOptionsVisible && outlinePane}
            {docOptionsVisible && checksPane}
            {draftPane}
            {assembledDraftPane}
          </main>
          {validationsVisible && validationRail}
          {/* Statistics sits to the right of the Validation rail. Fixed
              width when expanded; thin strip when collapsed. The left
              border separates it from the rail (the rail itself only
              has a left border). */}
          {validationsVisible && (
            <div
              className={
                "shrink-0 border-l border-neutral-200 " +
                (collapsedPanes.has("stats") ? "w-10" : "w-60")
              }
            >
              {statisticsPane}
            </div>
          )}
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
      {promptsOpen && (
        <PromptInspectorPanel log={promptLog} onClose={handleClosePrompts} />
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
          canGenerate={canGenerate}
          onNewDocument={handleNewDocument}
          onSelectTemplate={handleOpenPicker}
          onWriteDraft={handleWriteDraft}
          onGenerate={handleGenerate}
          onValidate={runValidate}
        />
      )}
      {paneHighlight && !isMobile && <PointerHint paneId={paneHighlight} />}
    </div>
  );
}

// Renders a large 👉 emoji at the left edge of the highlighted pane, animated
// to nudge horizontally. Position is computed once on mount via the pane's
// bounding rect; the parent already auto-clears the highlight after 3s.
function PointerHint({ paneId }: { paneId: string }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const el = window.document.getElementById(`pane-${paneId}`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      // Center vertically on the pane top third (where the heading lives, so
      // the finger lines up with something recognisable).
      top: rect.top + Math.min(rect.height * 0.18, 72),
      left: rect.left - 52,
    });
  }, [paneId]);

  if (!pos) return null;
  return (
    <div
      aria-hidden="true"
      data-testid="pane-pointer-hint"
      className="ds-pointer-hint pointer-events-none fixed z-50 text-5xl"
      style={{ top: pos.top, left: pos.left }}
    >
      👉
    </div>
  );
}

function hasAnyDraft(doc: Document): boolean {
  return Object.values(doc.draftSections).some(
    (text) => text && text.trim() !== ""
  );
}
