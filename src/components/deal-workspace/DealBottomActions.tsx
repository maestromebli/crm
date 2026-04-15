"use client";

import type { DealPrimaryNextAction } from "../../features/deal-workspace/deal-view-selectors";
import type { DealWorkspaceTabId } from "../../features/deal-workspace/types";
import { DEAL_WORKSPACE_TAB_LABELS } from "./deal-workspace-tabs";

type Props = {
  primaryAction: DealPrimaryNextAction;
  onPrimaryAction: () => void;
  onTab: (tab: DealWorkspaceTabId) => void;
  allowedTabs: DealWorkspaceTabId[];
};

const QUICK_TABS: DealWorkspaceTabId[] = ["tasks", "payment", "contract", "files", "activity"];

export function DealBottomActions({
  primaryAction,
  onPrimaryAction,
  onTab,
  allowedTabs,
}: Props) {
  const visibleQuick = QUICK_TABS.filter((tab) => allowedTabs.includes(tab)).slice(0, 4);
  const moreTabs = QUICK_TABS.filter((tab) => allowedTabs.includes(tab)).slice(4);

  return (
    <div className="sticky bottom-0 z-30 border-t border-[var(--enver-border)] bg-[var(--enver-card)]/95 px-3 py-2 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onPrimaryAction}
          className="rounded-full bg-[var(--enver-accent)] px-3 py-1.5 text-xs font-semibold text-white"
        >
          {primaryAction.label}
        </button>
        {visibleQuick.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTab(tab)}
            className="rounded-full border border-[var(--enver-border)] bg-[var(--enver-surface)] px-3 py-1.5 text-xs font-medium text-[var(--enver-text)] hover:bg-[var(--enver-hover)]"
          >
            {DEAL_WORKSPACE_TAB_LABELS[tab]}
          </button>
        ))}
        {moreTabs.length > 0 ? (
          <details className="relative">
            <summary className="list-none rounded-full border border-[var(--enver-border)] bg-[var(--enver-surface)] px-3 py-1.5 text-xs font-medium text-[var(--enver-text)] hover:bg-[var(--enver-hover)]">
              Ще
            </summary>
            <div className="absolute bottom-10 right-0 w-40 rounded-xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-1">
              {moreTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => onTab(tab)}
                  className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-[var(--enver-text)] hover:bg-[var(--enver-hover)]"
                >
                  {DEAL_WORKSPACE_TAB_LABELS[tab]}
                </button>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}
