"use client";

import { useState } from "react";
import {
  ESTIMATE_CATEGORY_LABELS,
  type EstimateCategoryKey,
} from "../../../../lib/estimates/estimate-categories";
import type { SnapshotLine } from "../../../../lib/estimates/estimate-version-diff";
import { EstimateItemRow } from "./EstimateItemRow";

type Props = {
  categoryKey: EstimateCategoryKey;
  lines: SnapshotLine[];
  rowVariant?: (line: SnapshotLine) => "default" | "added" | "changed";
  defaultOpen?: boolean;
  footerAdd?: boolean;
};

export function EstimateGroupSection({
  categoryKey,
  lines,
  rowVariant,
  defaultOpen = true,
  footerAdd = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const label = ESTIMATE_CATEGORY_LABELS[categoryKey];
  const catSub = lines.reduce((a, l) => a + l.amountSale, 0);

  if (lines.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200/90 bg-[var(--enver-card)] shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between border-b border-slate-100 bg-slate-50/80 px-3 py-2 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-800">
            {label}
          </span>
          <span className="text-[11px] tabular-nums text-slate-500">
            {catSub.toLocaleString("uk-UA")} грн
          </span>
        </div>
        <span className="text-slate-400">{open ? "▾" : "▸"}</span>
      </button>
      {open ? (
        <>
          <div className="divide-y divide-slate-50">
            {lines.map((line) => (
              <EstimateItemRow
                key={line.key}
                line={line}
                variant={rowVariant?.(line) ?? "default"}
              />
            ))}
          </div>
          {footerAdd ? (
            <div className="border-t border-slate-100 px-2 py-1.5">
              <button
                type="button"
                className="text-[11px] font-semibold text-blue-700 hover:underline"
              >
                + Додати позицію
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function groupLinesByCategory(
  lines: SnapshotLine[],
): Map<EstimateCategoryKey, SnapshotLine[]> {
  const m = new Map<EstimateCategoryKey, SnapshotLine[]>();
  for (const l of lines) {
    const arr = m.get(l.categoryKey) ?? [];
    arr.push(l);
    m.set(l.categoryKey, arr);
  }
  return m;
}
