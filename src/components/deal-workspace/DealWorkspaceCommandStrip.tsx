"use client";

import { useMemo } from "react";
import type { DealWorkspacePayload } from "../../features/deal-workspace/types";
import type { DealWorkspaceTabId } from "../../features/deal-workspace/types";
import {
  contractStatusShortUa,
  deriveDealPrimaryCta,
} from "../../features/deal-workspace/next-cta";
import { cn } from "../../lib/utils";

type Props = {
  data: DealWorkspacePayload;
  onTab: (id: DealWorkspaceTabId) => void;
};

export function DealWorkspaceCommandStrip({ data, onTab }: Props) {
  const cta = useMemo(() => deriveDealPrimaryCta(data), [data]);
  const pct = useMemo(() => {
    const milestones = data.paymentMilestones ?? [];
    const metaMs = data.meta.payment?.milestones ?? [];
    const rows =
      milestones.length > 0
        ? milestones.map((m) => ({
            amount: m.amount ?? 0,
            done: m.confirmedAt != null,
          }))
        : metaMs.map((m) => ({
            amount: m.amount ?? 0,
            done: m.done,
          }));
    let total = 0;
    let paid = 0;
    for (const r of rows) {
      total += r.amount;
      if (r.done) paid += r.amount;
    }
    if (total <= 0) return null;
    return Math.round((paid / total) * 100);
  }, [data.paymentMilestones, data.meta.payment?.milestones]);

  const readinessLabel = data.readinessAllMet
    ? "Готово до передачі"
    : `Не готово (${data.readiness.filter((x) => !x.done).length} блокерів)`;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-300/80 bg-gradient-to-br from-slate-900 to-slate-800 px-4 py-3 text-white shadow-md shadow-slate-900/20 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Головна дія
        </p>
        <p className="text-sm font-medium leading-snug text-white">{cta.label}</p>
        <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
          <span>Договір: {contractStatusShortUa(data.contract?.status ?? null)}</span>
          <span aria-hidden>·</span>
          <span>Готовність: {readinessLabel}</span>
          {pct != null ? (
            <>
              <span aria-hidden>·</span>
              <span>Оплата: {pct}%</span>
            </>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        {cta.disabledReason ? (
          <p className="max-w-xs text-[11px] text-amber-200/90">{cta.disabledReason}</p>
        ) : null}
        <button
          type="button"
          disabled={cta.disabled}
          onClick={() => onTab(cta.tab)}
          className={cn(
            "rounded-xl px-4 py-2.5 text-sm font-semibold transition",
            cta.disabled
              ? "cursor-not-allowed bg-slate-600 text-slate-300"
              : "bg-[var(--enver-card)] text-[var(--enver-text)] hover:bg-slate-100",
          )}
        >
          Перейти до дії
        </button>
      </div>
    </div>
  );
}
