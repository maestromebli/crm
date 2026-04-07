"use client";

import type { DealWorkspacePayload } from "../../features/deal-workspace/types";
import { cn } from "../../lib/utils";

type Props = {
  data: DealWorkspacePayload;
  activeTab: string;
  onTab: (id: string) => void;
};

type BarItem =
  | {
      id: string;
      kind: "tab";
      label: string;
      tab: string;
      disabled?: (d: DealWorkspacePayload) => boolean;
      reason?: (d: DealWorkspacePayload) => string | null;
    }
  | {
      id: string;
      kind: "tel";
      label: string;
      href: (d: DealWorkspacePayload) => string | null;
    };

const ACTIONS: BarItem[] = [
  { id: "sales", kind: "tab", label: "Огляд", tab: "overview" },
  { id: "msg", kind: "tab", label: "Чат/нотатки", tab: "messages" },
  { id: "call", kind: "tel", label: "Дзвінок", href: (d) => {
    const t = d.primaryContact?.phone?.replace(/\s+/g, "") ?? "";
    return t ? `tel:${t}` : null;
  }},
  { id: "est", kind: "tab", label: "Смета", tab: "estimate" },
  { id: "tasks", kind: "tab", label: "Задачі", tab: "tasks" },
  { id: "pay", kind: "tab", label: "Оплата", tab: "payment" },
  { id: "files", kind: "tab", label: "Файли", tab: "files" },
  { id: "docs", kind: "tab", label: "Договір", tab: "contract" },
  { id: "log", kind: "tab", label: "Журнал", tab: "activity" },
];

export function DealActionBar({ data, activeTab, onTab }: Props) {
  return (
    <div className="sticky bottom-0 z-30 border-t border-slate-200 bg-[var(--enver-card)] px-3 py-2 shadow-[0_-4px_20px_rgba(15,23,42,0.08)] md:px-4">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {ACTIONS.map((a) => {
            if (a.kind === "tel") {
              const href = a.href(data);
              if (!href) {
                return (
                  <span
                    key={a.id}
                    className="cursor-not-allowed rounded-full border border-slate-100 px-3 py-1.5 text-[11px] text-slate-400"
                    title="Немає телефону"
                  >
                    {a.label}
                  </span>
                );
              }
              return (
                <a
                  key={a.id}
                  href={href}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-medium text-emerald-950 hover:bg-emerald-100"
                >
                  {a.label}
                </a>
              );
            }
            const disabled = a.disabled?.(data) ?? false;
            const reason = a.reason?.(data);
            return (
              <button
                key={a.id}
                type="button"
                title={disabled && reason ? reason : undefined}
                disabled={disabled}
                onClick={() => onTab(a.tab)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[11px] font-medium transition",
                  activeTab === a.tab
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-[var(--enver-card)] text-slate-700 hover:bg-[var(--enver-hover)]",
                  disabled && "cursor-not-allowed opacity-50",
                )}
              >
                {a.label}
              </button>
            );
          })}
        </div>
        <p className="hidden max-w-xs text-[10px] text-slate-500 sm:block">
          Нижня панель: дзвінок і вкладки в один дотик.
        </p>
      </div>
    </div>
  );
}
