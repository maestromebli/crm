"use client";

import type { ProductionOrderHubView } from "../../types/production";
import { productionStatusEngine } from "../../services/productionStatusEngine";
import { ProductionNextActionCard } from "../../ProductionNextActionCard";
import { ProductionReadinessChecklist } from "../../ProductionReadinessChecklist";
import { ProductionTimeline } from "../../ProductionTimeline";
import { ProductionRiskPanel } from "../../ProductionRiskPanel";
import { OperationsAIWidget } from "@/features/operations-ai/OperationsAIWidget";
import { mapProductionHubToOpsState } from "../../integrations/crm-production-adapter";

export function ProductionOrderHubPage({ data }: { data: ProductionOrderHubView }) {
  const order = mapProductionHubToOpsState(data);
  const status = productionStatusEngine(order);

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs text-slate-500">{data.flow.number}</p>
        <h1 className="text-2xl font-semibold text-slate-900">{data.flow.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{data.flow.clientName}</p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <ProductionNextActionCard action={status.nextAction} />
          <ProductionReadinessChecklist items={status.checklist} />
          <ProductionTimeline events={order.timeline} />
        </div>
        <div className="space-y-4">
          <OperationsAIWidget order={order} />
          <ProductionRiskPanel blockers={status.blockers} />
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Статус</h3>
            <p className="mt-2 text-xl font-semibold text-slate-900">{status.currentStatus}</p>
            <p className="text-xs text-slate-500">Readiness: {status.readinessPercent}%</p>
          </section>
        </div>
      </section>
    </div>
  );
}
