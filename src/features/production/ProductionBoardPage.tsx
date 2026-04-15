import type { ProductionOrderOpsState } from "./types/operations-core";
import { ProductionKanban } from "./ProductionKanban";
import { ProductionCapacityPanel } from "./ProductionCapacityPanel";

export function ProductionBoardPage({ orders }: { orders: ProductionOrderOpsState[] }) {
  const capacity = [
    { stage: "Розкрій", loadPercent: 72 },
    { stage: "Кромка", loadPercent: 88 },
    { stage: "Присадка", loadPercent: 63 },
    { stage: "Збірка", loadPercent: 79 },
  ];

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Production Board</h1>
        <p className="text-sm text-slate-600">Головна операційна дошка цеху.</p>
      </header>
      <ProductionKanban orders={orders} />
      <ProductionCapacityPanel capacity={capacity} />
    </div>
  );
}
