import type { WarehouseReadinessStatus } from "@/features/production/types/operations-core";

export function MaterialAvailabilityBadge({ status }: { status: WarehouseReadinessStatus }) {
  const tone =
    status === "IN_STOCK"
      ? "bg-emerald-100 text-emerald-900"
      : status === "RESERVED"
        ? "bg-sky-100 text-sky-900"
        : status === "PARTIAL"
          ? "bg-amber-100 text-amber-900"
          : "bg-rose-100 text-rose-900";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{status}</span>;
}
