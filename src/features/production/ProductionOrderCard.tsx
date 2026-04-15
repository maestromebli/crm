import type { ProductionOrderOpsState } from "./types/operations-core";
import { productionStatusEngine } from "./services/productionStatusEngine";

export function ProductionOrderCard({ order }: { order: ProductionOrderOpsState }) {
  const snapshot = productionStatusEngine(order);
  const blocked = snapshot.blockers.length > 0;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs text-slate-500">{order.clientName}</p>
      <h4 className="mt-1 text-sm font-semibold text-slate-900">{order.orderName}</h4>
      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
        <span className={`rounded-full px-2 py-0.5 ${blocked ? "bg-rose-100 text-rose-900" : "bg-emerald-100 text-emerald-900"}`}>
          {blocked ? "Блокер" : "Без блокерів"}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{order.materialsReadiness}</span>
      </div>
      <p className="mt-2 text-xs text-slate-600">Next: {snapshot.nextAction.label}</p>
      <div className="mt-3 flex gap-2">
        <button className="rounded-md bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-white">Перевести далі</button>
        <button className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-medium">Відкрити деталі</button>
      </div>
    </article>
  );
}
