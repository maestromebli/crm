"use client";

import { Funnel } from "lucide-react";

export type InboxFilterTab =
  | "all"
  | "unread"
  | "unanswered"
  | "overdue"
  | "mine"
  | "unlinked";

type ConversationFiltersProps = {
  activeTab: InboxFilterTab;
  onChangeTab: (tab: InboxFilterTab) => void;
};

const tabs: { id: InboxFilterTab; label: string }[] = [
  { id: "all", label: "Усі" },
  { id: "unread", label: "Непрочитані" },
  { id: "unanswered", label: "Без відповіді" },
  { id: "overdue", label: "Прострочені" },
  { id: "mine", label: "Мої" },
  { id: "unlinked", label: "Без звʼязку з CRM" },
];

export function ConversationFilters({
  activeTab,
  onChangeTab,
}: ConversationFiltersProps) {
  return (
    <div className="space-y-2 pb-2">
      <div className="min-w-0 overflow-x-auto">
        <div className="inline-flex w-max rounded-full border border-slate-200 bg-[var(--enver-card)] p-0.5 text-[11px] shadow-sm shadow-slate-900/5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              className={`whitespace-nowrap rounded-full px-2 py-1 transition ${
                activeTab === tab.id
                  ? "bg-slate-900 text-slate-50"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-[var(--enver-card)] px-2.5 py-1.5 text-[11px] text-slate-700 shadow-sm shadow-slate-900/5 transition hover:bg-[var(--enver-hover)]"
        >
          <Funnel className="h-3.5 w-3.5" />
          Фільтри
        </button>
      </div>
    </div>
  );
}

