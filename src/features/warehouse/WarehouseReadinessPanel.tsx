import type { WarehouseReadinessStatus } from "@/features/production/types/operations-core";
import { ReservationStatusCard } from "./ReservationStatusCard";

export function WarehouseReadinessPanel({
  items,
}: {
  items: Array<{ id: string; material: string; qty: number; status: WarehouseReadinessStatus }>;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Warehouse readiness</h3>
      <p className="mt-1 text-xs text-slate-500">Швидка відповідь: в наявності / частково / під закупівлю / резерв.</p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <ReservationStatusCard key={item.id} material={item.material} qty={item.qty} status={item.status} />
        ))}
      </div>
    </section>
  );
}
