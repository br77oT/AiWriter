"use client";

import { useState, type ReactNode } from "react";

export type MobilePaneId =
  | "spec"
  | "outline"
  | "checks"
  | "draft"
  | "assembled"
  | "validation";

interface MobileWorkspaceLayoutProps {
  sidebar: ReactNode;
  spec: ReactNode;
  outline: ReactNode;
  checks: ReactNode;
  draft: ReactNode;
  assembled: ReactNode;
  validation: ReactNode;
}

const TABS: Array<{ id: MobilePaneId; label: string }> = [
  { id: "spec", label: "Spec" },
  { id: "outline", label: "Outline" },
  { id: "checks", label: "Checks" },
  { id: "draft", label: "Draft" },
  { id: "assembled", label: "Assembled" },
  { id: "validation", label: "Validation" },
];

// Mobile workspace shell: a Menu button (opens the sidebar drawer) + a tab bar
// (Spec / Outline / Checks / Draft / Assembled / Validation) + the active pane
// in the content area. Every label is plain text — no icon-only buttons
// (per PRD user story 35).
export function MobileWorkspaceLayout({
  sidebar,
  spec,
  outline,
  checks,
  draft,
  assembled,
  validation,
}: MobileWorkspaceLayoutProps) {
  const [activeTab, setActiveTab] = useState<MobilePaneId>("spec");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const panes: Record<MobilePaneId, ReactNode> = {
    spec,
    outline,
    checks,
    draft,
    assembled,
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
          {TABS.map((tab) => {
            const selected = activeTab === tab.id;
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
        data-testid={`mobile-active-pane-${activeTab}`}
      >
        {panes[activeTab]}
      </div>

      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 flex"
          role="dialog"
          aria-label="Documents and templates drawer"
        >
          <div className="relative flex h-full w-72 flex-col bg-white shadow-lg">
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
          <button
            type="button"
            aria-label="Close drawer"
            onClick={() => setDrawerOpen(false)}
            className="flex-1 bg-black/40"
          />
        </div>
      )}
    </div>
  );
}
