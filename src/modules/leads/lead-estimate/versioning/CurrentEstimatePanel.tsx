"use client";

import { ESTIMATE_CATEGORY_KEYS } from "../../../../lib/estimates/estimate-categories";
import type { SnapshotLine } from "../../../../lib/estimates/estimate-version-diff";
import {
  EstimateGroupSection,
  groupLinesByCategory,
} from "./EstimateGroupSection";

type Props = {
  version: number;
  total: number | null;
  statusNote: string;
  lines: SnapshotLine[];
};

export function CurrentEstimatePanel({
  version,
  total,
  statusNote,
  lines,
}: Props) {
  const grouped = groupLinesByCategory(lines);

  return (
    <section className="flex min-h-0 flex-col gap-3">
      <div className="rounded-lg border border-slate-200 bg-[var(--enver-card)] px-3 py-2 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Поточна (збережена)
        </p>
        <p className="text-sm font-bold text-[var(--enver-text)]">
          Смета v{version}
        </p>
        <p className="text-[11px] text-slate-600">{statusNote}</p>
        <p className="mt-1 text-lg font-bold tabular-nums text-slate-800">
          {total != null ? `${total.toLocaleString("uk-UA")} грн` : "—"}
        </p>
      </div>
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Позиції
      </h3>
      <div className="space-y-2">
        {ESTIMATE_CATEGORY_KEYS.map((cat) => {
          const catLines = grouped.get(cat) ?? [];
          if (catLines.length === 0) return null;
          return (
            <EstimateGroupSection
              key={cat}
              categoryKey={cat}
              lines={catLines}
              footerAdd
            />
          );
        })}
      </div>
    </section>
  );
}
