"use client";

import { ESTIMATE_CATEGORY_KEYS } from "../../../../lib/estimates/estimate-categories";
import type {
  DiffRow,
  SnapshotLine,
} from "../../../../lib/estimates/estimate-version-diff";
import {
  EstimateGroupSection,
  groupLinesByCategory,
} from "./EstimateGroupSection";
import { EstimateDiffSummary } from "./EstimateDiffSummary";

type Props = {
  newVersion: number;
  oldTotal: number | null;
  newTotal: number | null;
  diffRows: DiffRow[];
  previewLines: SnapshotLine[];
  summaryBullets: string[];
};

function variantForLine(
  line: SnapshotLine,
  diffRows: DiffRow[],
): "default" | "added" | "changed" {
  for (const d of diffRows) {
    if (d.kind === "added" && d.line.key === line.key) return "added";
    if (d.kind === "changed" && d.preview.key === line.key) return "changed";
  }
  return "default";
}

export function NewEstimatePreviewPanel({
  newVersion,
  oldTotal,
  newTotal,
  diffRows,
  previewLines,
  summaryBullets,
}: Props) {
  const grouped = groupLinesByCategory(previewLines);

  return (
    <section className="flex min-h-0 flex-col gap-3">
      <div className="rounded-lg border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white px-3 py-2 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
          Перегляд змін
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-slate-600">Нова:</span>
          <span className="font-bold text-[var(--enver-text)]">Смета v{newVersion}</span>
          <span className="text-slate-400">←</span>
          <span className="text-lg font-bold tabular-nums text-emerald-700">
            {newTotal != null ? `${newTotal.toLocaleString("uk-UA")} грн` : "—"}
          </span>
        </div>
      </div>

      <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Нова версія (попередній перегляд)
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
              rowVariant={(line) => variantForLine(line, diffRows)}
            />
          );
        })}
      </div>

      <EstimateDiffSummary
        oldTotal={oldTotal}
        newTotal={newTotal}
        bullets={summaryBullets}
      />
    </section>
  );
}
