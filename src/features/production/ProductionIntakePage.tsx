import { productionStatusEngine } from "./services/productionStatusEngine";
import type { ProductionOrderOpsState } from "./types/operations-core";
import { ProductionReadinessChecklist } from "./ProductionReadinessChecklist";
import { ProductionNextActionCard } from "./ProductionNextActionCard";
import { ProductionTimeline } from "./ProductionTimeline";
import { ProductionRiskPanel } from "./ProductionRiskPanel";

export function ProductionIntakePage({ order }: { order: ProductionOrderOpsState }) {
  const snapshot = productionStatusEngine(order);

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Production Intake</h1>
        <p className="mt-1 text-sm text-slate-600">
          {order.clientName} · {order.orderName}
        </p>
        <p className="text-xs text-slate-500">{order.address ?? "Адресу не вказано"}</p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4">
          <ProductionNextActionCard action={snapshot.nextAction} />
          <ProductionReadinessChecklist items={snapshot.checklist} />
          <ProductionTimeline events={order.timeline} />
        </div>
        <div className="space-y-4">
          <ProductionRiskPanel blockers={snapshot.blockers} />
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Готовність</h3>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{snapshot.readinessPercent}%</p>
            <p className="text-xs text-slate-500">{snapshot.currentStatus}</p>
          </section>
        </div>
      </section>
    </div>
  );
}
