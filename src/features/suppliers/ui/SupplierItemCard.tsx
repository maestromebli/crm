"use client";

import type { SupplierItem } from "../core/supplierTypes";

function formatPrice(price: number): string {
  return `${price.toLocaleString("uk-UA", { maximumFractionDigits: 2 })} грн`;
}

export function SupplierItemCard({
  item,
  compact = false,
}: {
  item: SupplierItem;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px]"
          : "rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{item.name}</p>
          <p className="text-[10px] text-slate-500">
            {item.code ? `${item.code} · ` : ""}
            {item.supplier}
            {item.category ? ` · ${item.category}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-semibold text-emerald-800">{formatPrice(item.price)}</p>
          <p className="text-[10px] text-slate-500">/{item.unit}</p>
        </div>
      </div>
    </div>
  );
}
