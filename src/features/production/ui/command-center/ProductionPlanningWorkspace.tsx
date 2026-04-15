import type { ProductionOrderViewModel } from "./models";

export function ProductionPlanningWorkspace({
  orders,
  selectedOrderId,
  onSelectOrder,
}: {
  orders: ProductionOrderViewModel[];
  selectedOrderId: string | null;
  onSelectOrder: (orderId: string, slot: number) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Main planning workspace</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-3 py-2">Pos</th>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Operational state</th>
              <th className="px-3 py-2">Deadline risk</th>
              <th className="px-3 py-2">Readiness</th>
              <th className="px-3 py-2">Planned slot</th>
              <th className="px-3 py-2">Priority reason</th>
              <th className="px-3 py-2">Assignment / blocker</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((row) => (
              <tr
                key={row.order.id}
                onClick={() => onSelectOrder(row.order.id, row.position)}
                className={`cursor-pointer border-t border-slate-100 ${
                  row.order.id === selectedOrderId ? "bg-sky-50" : "hover:bg-slate-50"
                }`}
              >
                <td className="px-3 py-2">#{row.position}</td>
                <td className="px-3 py-2">
                  <p className="font-medium text-slate-900">{row.order.number}</p>
                  <p className="text-xs text-slate-600">{row.order.clientName}</p>
                </td>
                <td className="px-3 py-2 text-xs text-slate-700">{row.operationalState.key}</td>
                <td className="px-3 py-2 text-xs text-slate-700">{row.deadlineRisk}</td>
                <td className="px-3 py-2 text-xs text-slate-700">{row.order.readinessPercent}%</td>
                <td className="px-3 py-2 text-xs text-slate-700">
                  {row.plannedStart} → {row.plannedFinish}
                </td>
                <td className="px-3 py-2 text-xs text-slate-700">{row.priorityReason.label}</td>
                <td className="px-3 py-2 text-xs text-slate-700">
                  <p>{row.workshopAssignment}</p>
                  <p className="text-[11px] text-slate-500">{row.dependency}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
