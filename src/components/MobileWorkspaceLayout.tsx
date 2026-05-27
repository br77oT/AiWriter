"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useEnterExit } from "@/lib/use-enter-exit";

// Drawer slide + backdrop fade duration. Slightly longer than the popover
// menu (150ms) because the drawer travels further across the screen.
const DRAWER_TRANSITION_MS = 200;

export type MobilePaneId =
  | "spec"
  | "outline"
  | "checks"
  | "draft"
  | "assembled"
  | "stats"
  | "validation";

interface MobileWorkspaceLayoutProps {
  sidebar: ReactNode;
  spec: ReactNode;
  outline: ReactNode;
  checks: ReactNode;
  draft: ReactNode;
  assembled: ReactNode;
  stats: ReactNode;
  validation: ReactNode;
  // Mirror the desktop TopBar toggles: when a group is hidden, its tabs are
  // omitted from the bar entirely. Defaults to fully visible so callers that
  // don't pass these (older tests) keep their old behavior.
  docOptionsVisible?: boolean;
  validationsVisible?: boolean;
  // Imperative request to switch to a specific tab. The nonce changes each
  // time the parent wants to trigger a switch — using a counter (not a flag)
  // lets repeat requests to the same tab re-trigger the effect.
  requestedActivePane?: MobilePaneId;
  requestedActivePaneNonce?: number;
}

const ALL_TABS: Array<{ id: MobilePaneId; label: string }> = [
  { id: "spec", label: "Tone and Purpose" },
  { id: "outline", label: "Document Outline" },
  { id: "checks", label: "Validation Checks" },
  { id: "draft", label: "Draft" },
  { id: "assembled", label: "Generated" },
  { id: "stats", label: "Stats" },
  { id: "validation", label: "Validation" },
];

const DOC_OPTION_TABS: MobilePaneId[] = ["spec", "outline", "checks"];
const VALIDATION_TABS: MobilePaneId[] = ["stats", "validation"];

// Mobile workspace shell: a Menu button (opens the sidebar drawer) + a tab
// bar (Spec / Outline / Checks / Draft / Assembled / Stats / Validation) +
// the active pane in the content area. Every label is plain text — no
// icon-only buttons (per PRD user story 35).
export function MobileWorkspaceLayout({
  sidebar,
  spec,
  outline,
  checks,
  draft,
  assembled,
  stats,
  validation,
  docOptionsVisible = true,
  validationsVisible = true,
  requestedActivePane,
  requestedActivePaneNonce,
}: MobileWorkspaceLayoutProps) {
  const tabs = ALL_TABS.filter((tab) => {
    if (DOC_OPTION_TABS.includes(tab.id)) return docOptionsVisible;
    if (VALIDATION_TABS.includes(tab.id)) return validationsVisible;
    return true;
  });
  // Always pick a tab that's actually rendered; "draft" is always present so
  // it's a safe fallback when the user hides whichever group held the prior
  // active tab.
  const [activeTab, setActiveTab] = useState<MobilePaneId>(() =>
    docOptionsVisible ? "spec" : "draft"
  );
  const activeIsVisible = tabs.some((t) => t.id === activeTab);
  const effectiveTab: MobilePaneId = activeIsVisible ? activeTab : "draft";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawer = useEnterExit(drawerOpen, DRAWER_TRANSITION_MS);

  // Honor parent-driven tab switches (e.g. clicking "Edit prompts" in the
  // Draft pane should jump to the Outline tab). Listening on the nonce alone
  // is what makes repeat requests re-fire — the requested pane id may be
  // unchanged but the nonce always advances.
  useEffect(() => {
    if (requestedActivePaneNonce === undefined || !requestedActivePane) return;
    setActiveTab(requestedActivePane);
  }, [requestedActivePaneNonce, requestedActivePane]);

  const panes: Record<MobilePaneId, ReactNode> = {
    spec,
    outline,
    checks,
    draft,
    assembled,
    stats,
    validation,
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div
        className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-3 py-2"
        data-testid="mobile-tab-bar"
      >
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100"
        >
          Menu
        </button>
        <div role="tablist" aria-label="Workspace panes" className="flex flex-wrap gap-1">
          {tabs.map((tab) => {
            const selected = effectiveTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveTab(tab.id)}
                className={
                  "rounded px-3 py-1 text-sm " +
                  (selected
                    ? "bg-neutral-900 text-white"
                    : "border border-neutral-300 bg-white hover:bg-neutral-100")
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
      <div
        className="flex flex-1 overflow-hidden"
        data-testid={`mobile-active-pane-${effectiveTab}`}
      >
        {panes[effectiveTab]}
      </div>

      {drawer.mounted && (
        <div
          className="fixed inset-0 z-30"
          role="dialog"
          aria-label="Documents and templates drawer"
        >
          {/* Backdrop sits behind the panel and fades independently. Absolute
              positioning (not flex children) so the slide-out doesn't yank
              the backdrop around with it. */}
          <button
            type="button"
            aria-label="Close drawer"
            onClick={() => setDrawerOpen(false)}
            className={
              "absolute inset-0 bg-black/40 transition-opacity duration-200 ease-out " +
              (drawer.entered ? "opacity-100" : "opacity-0")
            }
          />
          <div
            className={
              "absolute left-0 top-0 flex h-full w-72 flex-col bg-white shadow-lg transition-transform duration-200 ease-out " +
              (drawer.entered ? "translate-x-0" : "-translate-x-full")
            }
          >
            <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
              <span className="text-sm font-semibold">Menu</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs hover:bg-neutral-100"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{sidebar}</div>
          </div>
        </div>
      )}
    </div>
  );
}
