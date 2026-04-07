import type { OperatingCashBreakdown } from "../types/models";
import { OPERATING_CASH_BUCKET_ORDER, OPERATING_CASH_BUCKET_UA } from "../types/models";

function money(v: number): string {
  return v.toLocaleString("uk-UA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

type Props = {
  breakdown: OperatingCashBreakdown;
  title?: string;
  compact?: boolean;
};

export function FinanceOperatingBreakdown({ breakdown, title = "Грошові витрати по статтях", compact }: Props) {
  const total = OPERATING_CASH_BUCKET_ORDER.reduce((s, k) => s + breakdown[k], 0);

  if (total === 0 && compact) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600">
        {title}: немає проведених витрат у цьому зрізі.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-[var(--enver-card)]">
      <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{title}</p>
        <p className="text-[10px] text-slate-500">Джерело: транзакції фінансів (не план закупівель).</p>
      </div>
      <table className="w-full text-left text-xs">
        <tbody className="divide-y divide-slate-100">
          {OPERATING_CASH_BUCKET_ORDER.map((k) => {
            const v = breakdown[k];
            if (compact && v === 0) return null;
            const pct = total > 0 ? Math.round((v / total) * 100) : 0;
            return (
              <tr key={k} className="hover:bg-[var(--enver-hover)]/80">
                <td className="px-3 py-1.5 text-slate-700">{OPERATING_CASH_BUCKET_UA[k]}</td>
                <td className="px-3 py-1.5 text-right font-medium tabular-nums text-[var(--enver-text)]">{money(v)}</td>
                <td className="w-14 px-3 py-1.5 text-right text-slate-400">{total > 0 ? `${pct}%` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 bg-slate-50/90 font-semibold">
            <td className="px-3 py-2 text-slate-800">Разом</td>
            <td className="px-3 py-2 text-right tabular-nums text-[var(--enver-text)]">{money(total)}</td>
            <td className="px-3 py-2 text-right text-slate-500">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
