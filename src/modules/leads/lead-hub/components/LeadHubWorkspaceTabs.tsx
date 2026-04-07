"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import type { LeadWorkspaceTabId } from "../../../../stores/lead-workspace-store";
import { cn } from "../../../../lib/utils";

const TABS: { id: LeadWorkspaceTabId; label: string }[] = [
  { id: "communication", label: "Комунікація" },
  { id: "files", label: "Файли" },
  { id: "measurement", label: "Замір" },
  { id: "calculation", label: "Розрахунок" },
  { id: "quote", label: "КП" },
  { id: "notes", label: "Нотатки" },
];

type Props = {
  activeTab: LeadWorkspaceTabId;
  onTabChange: (tab: LeadWorkspaceTabId) => void;
  panels: Record<LeadWorkspaceTabId, ReactNode>;
  className?: string;
};

export function LeadHubWorkspaceTabs({
  activeTab,
  onTabChange,
  panels,
  className,
}: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <div className={cn("space-y-4", className)}>
      <div
        role="tablist"
        aria-label="Робочі вкладки ліда"
        className="flex flex-wrap gap-1 rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-surface)] p-1"
      >
        {TABS.map((t) => {
          const selected = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onTabChange(t.id)}
              className={cn(
                "rounded-[10px] px-3 py-2 text-[12px] font-medium transition-colors",
                selected
                  ? "bg-[var(--enver-card)] text-[var(--enver-text)] shadow-sm"
                  : "text-[var(--enver-muted)] hover:text-[var(--enver-text)]",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeTab}
          role="tabpanel"
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="space-y-5"
        >
          {panels[activeTab] ?? panels.communication}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
