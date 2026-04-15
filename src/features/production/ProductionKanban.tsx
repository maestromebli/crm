import type { ProductionOrderOpsState } from "./types/operations-core";
import { ProductionOrderCard } from "./ProductionOrderCard";

const stageColumns = [
  "NEW_IN_PRODUCTION",
  "PREPARATION",
  "CUTTING",
  "EDGING",
  "DRILLING",
  "PAINTING",
  "ASSEMBLY",
  "PACKING",
  "READY",
  "DELAYED",
] as const;

export function ProductionKanban({ orders }: { orders: ProductionOrderOpsState[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {stageColumns.map((stage) => {
        const stageOrders = orders.filter((order) => (order.productionStage ?? "NEW_IN_PRODUCTION") === stage);
        return (
          <section key={stage} className="min-w-[260px] rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <header className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-800">{stage}</h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-700">{stageOrders.length}</span>
            </header>
            <div className="space-y-2">
              {stageOrders.map((order) => (
                <ProductionOrderCard key={order.orderId} order={order} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
