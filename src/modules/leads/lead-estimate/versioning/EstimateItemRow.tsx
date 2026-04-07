"use client";

import { MoreHorizontal } from "lucide-react";
import type { SnapshotLine } from "../../../../lib/estimates/estimate-version-diff";
import { cn } from "../../../../lib/utils";

function coefficientFor(line: SnapshotLine) {
  const denom = line.qty * line.salePrice;
  if (denom <= 0) return 1;
  return Math.round((line.amountSale / denom) * 1000) / 1000;
}

export function EstimateItemRow({
  line,
  variant = "default",
}: {
  line: SnapshotLine;
  variant?: "default" | "added" | "changed";
}) {
  const coeff = coefficientFor(line);

  return (
    <div
      className={cn(
        "grid grid-cols-[36px_minmax(0,1fr)_52px_52px_72px_88px_32px] items-center gap-px border-b border-slate-100 px-2 py-1.5 text-[11px] md:gap-1",
        variant === "added" && "bg-emerald-50/90",
        variant === "changed" && "bg-amber-50/60",
      )}
    >
      <div className="h-8 w-8 shrink-0 rounded border border-slate-200 bg-slate-100" />
      <div className="min-w-0">
        <span className="truncate font-medium text-[var(--enver-text)]">
          {line.productName}
        </span>
        {line.supplierMaterialName ? (
          <span className="mt-0.5 inline-block max-w-full truncate rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">
            {line.supplierProvider ?? "каталог"} · {line.supplierMaterialName}
          </span>
        ) : null}
      </div>
      <span className="tabular-nums text-slate-700">
        {line.qty.toLocaleString("uk-UA", { maximumFractionDigits: 2 })}
      </span>
      <span className="tabular-nums text-slate-600">{coeff}</span>
      <span className="tabular-nums text-slate-700">
        {line.salePrice.toLocaleString("uk-UA")}
      </span>
      <span className="text-right font-semibold tabular-nums text-[var(--enver-text)]">
        {line.amountSale.toLocaleString("uk-UA")}
      </span>
      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        aria-label="Дії"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </div>
  );
}
