"use client";

import type { DealWorkspacePayload } from "../../features/deal-workspace/types";
import { resolveDealActionPlan } from "../../features/action-system";
import { cn } from "../../lib/utils";

type Props = {
  data: DealWorkspacePayload;
  activeTab: string;
  onTab: (id: string) => void;
  onRequestEditHeader?: () => void;
};

type BarItem =
  {
    id: string;
    kind: "tab";
    label: string;
    tab: string;
    disabled?: (d: DealWorkspacePayload) => boolean;
    reason?: (d: DealWorkspacePayload) => string | null;
  };

const ACTIONS: BarItem[] = [
  { id: "est", kind: "tab", label: "Смета", tab: "estimate" },
  { id: "tasks", kind: "tab", label: "Задачі", tab: "tasks" },
  { id: "pay", kind: "tab", label: "Оплата", tab: "payment" },
  { id: "files", kind: "tab", label: "Файли", tab: "files" },
  { id: "docs", kind: "tab", label: "Договір", tab: "contract" },
  { id: "log", kind: "tab", label: "Журнал", tab: "activity" },
];

export function DealActionBar({ data, activeTab, onTab, onRequestEditHeader }: Props) {
  const plan = resolveDealActionPlan(data);
  const telQuick = plan.quick.find((x) => x.kind === "tel");
  return (
    <div className="sticky bottom-0 z-30 border-t border-slate-200 bg-[var(--enver-card)] px-3 py-2 shadow-[0_-4px_20px_rgba(15,23,42,0.08)] md:px-4">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (plan.primary.kind === "tab" && plan.primary.tabId) {
                onTab(plan.primary.tabId);
                return;
              }
              if (plan.primary.kind === "command") {
                onTab("overview");
                onRequestEditHeader?.();
              }
            }}
            className="rounded-full border border-indigo-300 bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-700"
            title={plan.primary.label}
          >
            {plan.primary.label}
          </button>
          {plan.secondary.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                if (a.kind === "tab" && a.tabId) onTab(a.tabId);
              }}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[11px] font-medium transition",
                a.kind === "tab" && activeTab === a.tabId
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-[var(--enver-card)] text-slate-700 hover:bg-[var(--enver-hover)]",
              )}
            >
              {a.label}
            </button>
          ))}
          {ACTIONS.map((a) => {
            const disabled =
              "disabled" in a && typeof a.disabled === "function"
                ? a.disabled(data)
                : false;
            const reason =
              "reason" in a && typeof a.reason === "function"
                ? a.reason(data)
                : null;
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
        {telQuick?.href ? (
          <a
            href={telQuick.href}
            className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-medium text-emerald-950 hover:bg-emerald-100"
          >
            {telQuick.label}
          </a>
        ) : null}
        <p className="hidden max-w-xs text-[10px] text-slate-500 sm:block">
          Нижня панель: головна дія + до трьох допоміжних.
        </p>
      </div>
    </div>
  );
}
