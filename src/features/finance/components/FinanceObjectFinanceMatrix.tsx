import Link from "next/link";
import type { ObjectFinanceLedgerRow } from "../lib/object-finance";
import { formatMoneyUa } from "../lib/format-money";

type Props = {
  rows: ObjectFinanceLedgerRow[];
  consolidated: ObjectFinanceLedgerRow;
};

export function FinanceObjectFinanceMatrix({ rows, consolidated }: Props) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <table className="min-w-[960px] w-full text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100/95 text-[11px] font-semibold uppercase tracking-wide text-slate-600 backdrop-blur-sm">
            <tr>
              <th className="px-4 py-3 text-left">Замовлення</th>
              <th className="px-4 py-3 text-left">Об&apos;єкт</th>
              <th className="border-l border-slate-200/90 bg-emerald-50/50 px-3 py-3 text-right text-emerald-900" title="Надходження готівкою">
                Надх.
              </th>
              <th className="bg-rose-50/40 px-3 py-3 text-right text-rose-900" title="Операційні витрати">
                Витр.
              </th>
              <th className="px-3 py-3 text-right text-amber-900" title="Зарплата з каси">
                ЗП
              </th>
              <th className="border-r border-slate-200/90 px-3 py-3 text-right text-violet-900" title="Комісії">
                Ком.
              </th>
              <th className="bg-slate-50/80 px-3 py-3 text-right text-slate-700" title="План закупівель">
                Зак. план
              </th>
              <th className="bg-slate-50/80 px-3 py-3 text-right text-slate-800" title="Факт закупівель">
                Зак. факт
              </th>
              <th className="px-3 py-3 text-right text-amber-950" title="Нарахована ЗП">
                Нар. ЗП
              </th>
              <th className="border-r border-slate-200/90 px-3 py-3 text-right text-rose-900" title="Відкриті замовлення">
                PO
              </th>
              <th className="px-4 py-3 text-left">Дії</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.objectId}
                className={`border-t border-slate-100 transition-colors hover:bg-slate-50/90 ${i % 2 === 1 ? "bg-slate-50/40" : ""}`}
              >
                <td className="px-4 py-3 align-top">
                  <span className="text-xs font-semibold text-slate-500">{r.projectCode}</span>
                  <p className="mt-0.5 max-w-[12rem] text-[13px] font-medium leading-snug text-slate-900">{r.projectTitle}</p>
                </td>
                <td className="px-4 py-3 align-top text-slate-800">
                  <span className="font-medium">{r.objectTitle}</span>
                  <p className="mt-0.5 max-w-[14rem] text-xs leading-relaxed text-slate-500">{r.objectAddress}</p>
                </td>
                <td className="border-l border-slate-100 px-3 py-3 text-right tabular-nums text-emerald-800">{formatMoneyUa(r.incomeCash)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-rose-800">{formatMoneyUa(r.expenseCash)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-amber-900">{formatMoneyUa(r.payrollCash)}</td>
                <td className="border-r border-slate-100 px-3 py-3 text-right tabular-nums text-violet-900">{formatMoneyUa(r.commissionCash)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-700">{formatMoneyUa(r.procurementPlanned)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-800">{formatMoneyUa(r.procurementAccrual)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-amber-950">{formatMoneyUa(r.payrollAccrued)}</td>
                <td className="border-r border-slate-100 px-3 py-3 text-right tabular-nums text-rose-900">{formatMoneyUa(r.openPurchaseOrders)}</td>
                <td className="px-4 py-3 align-top">
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
                    <Link
                      href={`/crm/finance/${r.projectId}`}
                      className="inline-flex justify-center rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-1.5 text-xs font-medium text-blue-800 transition hover:bg-blue-100"
                    >
                      Фінанси
                    </Link>
                    <Link
                      href={`/crm/procurement/${r.projectId}`}
                      className="inline-flex justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-950 transition hover:bg-amber-100"
                    >
                      Закупівля
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-300 bg-gradient-to-r from-slate-100 to-slate-50 font-semibold">
              <td className="px-4 py-3 text-slate-900" colSpan={2}>
                <span className="text-xs text-slate-500">Підсумок</span>
                <p className="text-sm text-slate-900">{consolidated.projectTitle} — {consolidated.objectTitle}</p>
              </td>
              <td className="border-l border-slate-200 px-3 py-3 text-right tabular-nums text-emerald-900">{formatMoneyUa(consolidated.incomeCash)}</td>
              <td className="px-3 py-3 text-right tabular-nums text-rose-900">{formatMoneyUa(consolidated.expenseCash)}</td>
              <td className="px-3 py-3 text-right tabular-nums text-amber-950">{formatMoneyUa(consolidated.payrollCash)}</td>
              <td className="border-r border-slate-200 px-3 py-3 text-right tabular-nums text-violet-900">{formatMoneyUa(consolidated.commissionCash)}</td>
              <td className="px-3 py-3 text-right tabular-nums text-slate-800">{formatMoneyUa(consolidated.procurementPlanned)}</td>
              <td className="px-3 py-3 text-right tabular-nums text-slate-900">{formatMoneyUa(consolidated.procurementAccrual)}</td>
              <td className="px-3 py-3 text-right tabular-nums text-amber-950">{formatMoneyUa(consolidated.payrollAccrued)}</td>
              <td className="border-r border-slate-200 px-3 py-3 text-right tabular-nums text-rose-950">{formatMoneyUa(consolidated.openPurchaseOrders)}</td>
              <td className="px-4 py-3 text-xs font-medium text-slate-600">Портфель</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="rounded-lg bg-slate-50/90 px-3 py-2 text-xs leading-relaxed text-slate-600">
        <strong className="font-medium text-slate-700">Як читати:</strong> закупівлі з позицій по об&apos;єкту; cash — з проводок.
        Відкриті PO — на рівні замовлення; у демо один об&apos;єкт на проєкт — цифри узгоджуються з закупівлями.
      </p>
    </div>
  );
}
