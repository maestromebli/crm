"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Calculator,
  CalendarClock,
  FileText,
  Files,
  MessageSquare,
  NotebookPen,
} from "lucide-react";
import type { ReactNode } from "react";
import type { LeadWorkspaceTabId } from "../../../../stores/lead-workspace-store";
import { cn } from "../../../../lib/utils";

const TABS: {
  id: LeadWorkspaceTabId;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: "communication",
    label: "Комунікація",
    hint: "Дзвінки, повідомлення та задачі",
    icon: MessageSquare,
  },
  { id: "files", label: "Файли", hint: "Фото, документи та вкладення", icon: Files },
  { id: "measurement", label: "Замір", hint: "Планування та виїзди", icon: CalendarClock },
  {
    id: "calculation",
    label: "Розрахунок / КП",
    hint: "Смета та комерційна пропозиція",
    icon: Calculator,
  },
  { id: "quote", label: "Пропозиція", hint: "Комерційна пропозиція клієнту", icon: FileText },
  { id: "notes", label: "Нотатки", hint: "Внутрішні записи", icon: NotebookPen },
];

type Props = {
  activeTab: LeadWorkspaceTabId;
  onTabChange: (tab: LeadWorkspaceTabId) => void;
  panels: Record<LeadWorkspaceTabId, ReactNode>;
  visibleTabs?: LeadWorkspaceTabId[];
  /** Порядок переходів клавіатурою (може відрізнятися від візуального). */
  transitionTabs?: LeadWorkspaceTabId[];
  className?: string;
};

export function LeadHubWorkspaceTabs({
  activeTab,
  onTabChange,
  panels,
  visibleTabs,
  transitionTabs,
  className,
}: Props) {
  const reduceMotion = useReducedMotion();
  const tabs = visibleTabs?.length
    ? TABS.filter((t) => visibleTabs.includes(t.id))
    : TABS;
  const transitionOrder = (transitionTabs?.length
    ? transitionTabs
        .filter((tab, index, arr) => arr.indexOf(tab) === index)
        .filter((tab) => tabs.some((t) => t.id === tab))
    : tabs.map((t) => t.id)) as LeadWorkspaceTabId[];
  const fallbackTab = transitionOrder[0] ?? tabs[0]?.id ?? "communication";
  const activeInOrder = transitionOrder.includes(activeTab) ? activeTab : fallbackTab;

  const onTabListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!transitionOrder.length) return;
    const idx = transitionOrder.findIndex((tab) => tab === activeInOrder);
    if (idx < 0) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      const next = transitionOrder[(idx + 1) % transitionOrder.length];
      if (next) onTabChange(next);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      const prev =
        transitionOrder[(idx - 1 + transitionOrder.length) % transitionOrder.length];
      if (prev) onTabChange(prev);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      onTabChange(transitionOrder[0] ?? fallbackTab);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      onTabChange(transitionOrder[transitionOrder.length - 1] ?? fallbackTab);
      return;
    }
    if (event.ctrlKey && /^[1-9]$/.test(event.key)) {
      const target = transitionOrder[Number(event.key) - 1];
      if (target) {
        event.preventDefault();
        onTabChange(target);
      }
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && idx >= 0) {
      event.preventDefault();
      onTabChange(transitionOrder[idx] ?? fallbackTab);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div
        role="tablist"
        aria-label="Робочі вкладки ліда"
        onKeyDown={onTabListKeyDown}
        className="leadhub-card flex flex-wrap gap-1.5 p-1.5"
      >
        {tabs.map((t) => {
          const selected = activeTab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={t.label}
              onClick={() => onTabChange(t.id)}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-[11px] px-3 py-2 text-[12px] font-medium transition-all duration-200",
                selected
                  ? "bg-[var(--enver-card)] text-[var(--enver-text)] shadow-[0_8px_16px_rgba(15,23,42,0.12)] ring-1 ring-[var(--enver-border)]"
                  : "text-[var(--enver-muted)] hover:-translate-y-0.5 hover:bg-[var(--enver-hover)]/65 hover:text-[var(--enver-text)]",
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", selected ? "text-indigo-600" : "")} />
              <span>{t.label}</span>
              <span className="hidden text-[10px] text-[var(--enver-muted)] xl:inline">
                · {t.hint}
              </span>
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
