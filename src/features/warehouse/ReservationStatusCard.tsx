import { MaterialAvailabilityBadge } from "./MaterialAvailabilityBadge";
import type { WarehouseReadinessStatus } from "@/features/production/types/operations-core";

export function ReservationStatusCard({
  material,
  qty,
  status,
}: {
  material: string;
  qty: number;
  status: WarehouseReadinessStatus;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">{material}</p>
      <p className="text-xs text-slate-600">Кількість: {qty}</p>
      <div className="mt-2">
        <MaterialAvailabilityBadge status={status} />
      </div>
    </article>
  );
}
