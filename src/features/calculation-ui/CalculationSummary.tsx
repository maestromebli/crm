"use client";

import type { CalculationTotals } from "./calculationStore";

type Props = {
  totals: CalculationTotals;
  onChangeMarkup: (markupPercent: number) => void;
};

function money(value: number) {
  return `${value.toLocaleString("uk-UA", { maximumFractionDigits: 2 })} ₴`;
}

export function CalculationSummary({ totals, onChangeMarkup }: Props) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">Підсумок</h3>
      <div className="mt-3 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Собівартість</span>
          <span className="font-medium">{money(totals.costTotal)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Націнка (%)</span>
          <input
            type="number"
            className="w-20 rounded-md border border-slate-200 px-2 py-1 text-right text-sm"
            value={totals.markupPercent}
            onChange={(e) => onChangeMarkup(Number(e.target.value) || 0)}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Замір</span>
          <span className="font-medium">{money(totals.measurementCost)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-base">
          <span className="font-semibold text-slate-900">Вартість</span>
          <span className="font-semibold text-blue-700">{money(totals.finalTotal)}</span>
        </div>
      </div>
    </section>
  );
}
