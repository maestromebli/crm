"use client";

import { useOperationsAI } from "./useOperationsAI";
import type { ProductionOrderOpsState } from "@/features/production/types/operations-core";

const severityTone: Record<string, string> = {
  LOW: "bg-emerald-50 border-emerald-200 text-emerald-900",
  MEDIUM: "bg-amber-50 border-amber-200 text-amber-900",
  HIGH: "bg-orange-50 border-orange-200 text-orange-900",
  CRITICAL: "bg-rose-50 border-rose-200 text-rose-900",
};

export function OperationsAIWidget({ order }: { order: ProductionOrderOpsState }) {
  const insights = useOperationsAI(order);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">AI контроль</h3>
      <p className="mt-1 text-xs text-slate-500">Короткі сигнали про ризики, блокери та next-step.</p>
      <ul className="mt-3 space-y-2">
        {insights.slice(0, 4).map((insight) => (
          <li key={insight.id} className={`rounded-xl border p-3 text-xs ${severityTone[insight.severity] ?? severityTone.MEDIUM}`}>
            <p className="font-semibold">{insight.title}</p>
            <p className="mt-1">{insight.description}</p>
            {insight.suggestedAction ? <p className="mt-1 font-medium">Дія: {insight.suggestedAction}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
