import type { ProductionOrderOpsState } from "./types/operations-core";

export function ProductionStageDetailsDrawer({ order }: { order: ProductionOrderOpsState }) {
  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Деталі стадії</h3>
      <p className="mt-1 text-xs text-slate-600">{order.orderName}</p>
      <ul className="mt-3 space-y-2 text-xs">
        <li>Стадія: {order.productionStage ?? "NEW_IN_PRODUCTION"}</li>
        <li>Матеріали: {order.materialsReadiness}</li>
        <li>Монтаж: {order.installationStatus ?? "NOT_PLANNED"}</li>
        <li>Пріоритет: {order.priority}</li>
      </ul>
    </aside>
  );
}
