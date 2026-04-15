"use client";

import { useMemo } from "react";
import { DEAL_WORKSPACE_TAB_GROUPS, DEAL_WORKSPACE_TAB_LABELS } from "./deal-workspace-tabs";
import type { DealWorkspaceTabId } from "../../features/deal-workspace/types";
import { cn } from "../../lib/utils";

type Props = {
  activeTab: DealWorkspaceTabId;
  visibleTabIds: DealWorkspaceTabId[];
  onTab: (tab: DealWorkspaceTabId) => void;
};

export function DealWorkTabs({ activeTab, visibleTabIds, onTab }: Props) {
  const groups = useMemo(() => {
    return DEAL_WORKSPACE_TAB_GROUPS.map((group) => {
      const tabs = group.tabs.filter((tab) => visibleTabIds.includes(tab));
      if (tabs.length === 0) return null;
      return { ...group, tabs };
    }).filter((group): group is NonNullable<typeof group> => Boolean(group));
  }, [visibleTabIds]);

  const activeGroup = groups.find((group) => group.tabs.includes(activeTab)) ?? groups[0];
  if (!activeGroup) return null;

  return (
    <nav className="space-y-2 rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-2">
      <div className="flex flex-wrap gap-1">
        {groups.map((group) => {
          const selected = group.tabs.includes(activeTab);
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
              {group.label}
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
            )}
          >
            {DEAL_WORKSPACE_TAB_LABELS[tab]}
          </button>
        ))}
      </div>
    </nav>
  );
}
