import type { ProductionOrderViewModel } from "./models";

export function ActiveOrdersPanel({
  orders,
  selectedOrderId,
  onSelect,
}: {
  orders: ProductionOrderViewModel[];
  selectedOrderId: string | null;
  onSelect: (orderId: string, slot: number) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Active work</h3>
      <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
        {orders.length === 0 ? <li className="text-xs text-slate-500">No active orders.</li> : null}
        {orders.slice(0, 8).map((row) => (
          <li
            key={row.order.id}
            className={`cursor-pointer rounded-lg border px-2.5 py-2 ${
              selectedOrderId === row.order.id ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100"
            }`}
            onClick={() => onSelect(row.order.id, row.position)}
          >
            <p className="text-xs font-semibold text-slate-900">
              {row.order.number} · {row.order.clientName}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-700">{row.order.title}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              {row.operationalState.key} · due risk {row.deadlineRisk} · {row.workshopAssignment}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
