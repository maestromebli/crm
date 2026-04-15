import type { ProductionOrderOpsState } from "@/features/production/types/operations-core";

export function ConstructorSummaryPanel({ order }: { order: ProductionOrderOpsState }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{order.orderName}</h2>
      <p className="mt-1 text-sm text-slate-600">{order.clientName}</p>
      <p className="text-xs text-slate-500">{order.address ?? "Адресу не вказано"}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3 text-xs">
          <p className="text-slate-500">Стадія</p>
          <p className="font-semibold text-slate-900">{order.stage}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 text-xs">
          <p className="text-slate-500">Матеріали</p>
          <p className="font-semibold text-slate-900">{order.materialsReadiness}</p>
        </div>
      </div>
    </section>
  );
}
