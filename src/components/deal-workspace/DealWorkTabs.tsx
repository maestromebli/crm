"use client";

import { useMemo } from "react";
import { DEAL_WORKSPACE_TAB_GROUPS, DEAL_WORKSPACE_TAB_LABELS } from "./deal-workspace-tabs";
import type { DealWorkspaceTabId } from "../../features/deal-workspace/types";
import { cn } from "../../lib/utils";
import type {
  DealManagerJourneyAction,
  DealTabState,
} from "../../features/deal-workspace/deal-view-selectors";

type Props = {
  activeTab: DealWorkspaceTabId;
  visibleTabIds: DealWorkspaceTabId[];
  onTab: (tab: DealWorkspaceTabId) => void;
  recommendedTab: DealWorkspaceTabId;
  tabStateMap: Partial<Record<DealWorkspaceTabId, DealTabState>>;
  quickActions: DealManagerJourneyAction[];
};

const GROUP_STATE_LABELS: Record<DealTabState, string> = {
  ok: "Норма",
  attention: "Увага",
  blocked: "Блокер",
};

export function DealWorkTabs({
  activeTab,
  visibleTabIds,
  onTab,
  recommendedTab,
  tabStateMap,
  quickActions,
}: Props) {
  const groups = useMemo(() => {
    return DEAL_WORKSPACE_TAB_GROUPS.map((group) => {
      const tabs = group.tabs.filter((tab) => visibleTabIds.includes(tab));
      if (tabs.length === 0) return null;
      return { ...group, tabs };
    }).filter((group): group is NonNullable<typeof group> => Boolean(group));
  }, [visibleTabIds]);
  const groupStates = useMemo(() => {
    return new Map(
      groups.map((group) => {
        const hasBlocked = group.tabs.some((tab) => tabStateMap[tab] === "blocked");
        const hasAttention = group.tabs.some((tab) => tabStateMap[tab] === "attention");
        const state: DealTabState = hasBlocked
          ? "blocked"
          : hasAttention
            ? "attention"
            : "ok";
        return [group.id, state];
      }),
    );
  }, [groups, tabStateMap]);

  const activeGroup = groups.find((group) => group.tabs.includes(activeTab)) ?? groups[0];
  if (!activeGroup) return null;

  return (
    <nav className="space-y-2 rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-2">
      <div className="flex flex-wrap gap-1">
        {groups.map((group) => {
          const selected = group.tabs.includes(activeTab);
          const state = groupStates.get(group.id) ?? "ok";
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => onTab((selected ? activeTab : group.defaultTab) as DealWorkspaceTabId)}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-medium transition",
                selected
                  ? "bg-[var(--enver-accent)] text-white"
                  : "text-[var(--enver-text-muted)] hover:bg-[var(--enver-hover)]",
              )}
            >
              <span>{group.label}</span>
              <span
                className={cn(
                  "ml-1.5 rounded-full border px-1.5 py-0.5 text-[10px]",
                  selected && "border-white/35 text-white",
                  !selected && state === "blocked" && "border-rose-200 bg-rose-50 text-rose-900",
                  !selected &&
                    state === "attention" &&
                    "border-amber-200 bg-amber-50 text-amber-900",
                  !selected && state === "ok" && "border-emerald-200 bg-emerald-50 text-emerald-900",
                )}
              >
                {GROUP_STATE_LABELS[state]}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1 border-t border-[var(--enver-border)] pt-2">
        {activeGroup.tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTab(tab)}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-xs font-medium",
              activeTab === tab
                ? "bg-[var(--enver-surface)] text-[var(--enver-text)]"
                : "text-[var(--enver-text-muted)] hover:bg-[var(--enver-hover)]",
              tab === recommendedTab &&
                activeTab !== tab &&
                "border border-[var(--enver-accent)] bg-[var(--enver-accent-soft)]",
            )}
          >
            {DEAL_WORKSPACE_TAB_LABELS[tab]}
          </button>
        ))}
      </div>
      {quickActions.length > 0 ? (
        <div className="border-t border-[var(--enver-border)] pt-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
            Швидкі дії
          </p>
          <div className="flex flex-wrap gap-1">
            {quickActions.slice(0, 3).map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => onTab(action.tab)}
                className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2 py-1 text-[11px] text-[var(--enver-text)] hover:bg-[var(--enver-hover)]"
                title={action.hint}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </nav>
  );
}
