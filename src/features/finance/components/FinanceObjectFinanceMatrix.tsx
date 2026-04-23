import type { ObjectFinanceLedgerRow } from "../lib/object-finance";
import { formatMoneyUa } from "../lib/format-money";
import Link from "next/link";

type Props = {
  rows: ObjectFinanceLedgerRow[];
  consolidated: ObjectFinanceLedgerRow;
};

function normalizeOrderNumber(input: string): string | null {
  const value = input.trim().toUpperCase();
  const match = /^([A-ZА-ЯІЇЄҐ]{1,4}-\d{1,4}(?:\.\d{1,2})?)/u.exec(value);
  return match ? match[1] : null;
}

function deriveOrderNumber(row: ObjectFinanceLedgerRow): string {
  return (
    normalizeOrderNumber(row.projectCode) ??
    normalizeOrderNumber(row.projectTitle) ??
    row.projectCode
  );
}

function stripOrderPrefix(text: string, orderNumber: string): string {
  const escaped = orderNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text
    .replace(new RegExp(`^${escaped}\\s*[·:—-]?\\s*`, "iu"), "")
    .trim();
}

function deriveObjectTitle(row: ObjectFinanceLedgerRow): string {
  const orderNumber = deriveOrderNumber(row);
  const fromObject = stripOrderPrefix(row.objectTitle, orderNumber);
  if (fromObject && fromObject !== row.objectTitle) return fromObject;
  const fromProject = stripOrderPrefix(row.projectTitle, orderNumber);
  return fromProject || row.objectTitle || "—";
}

export function FinanceObjectFinanceMatrix({ rows, consolidated }: Props) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <table className="min-w-[960px] w-full text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100/95 text-[11px] font-semibold uppercase tracking-wide text-slate-600 backdrop-blur-sm">
            <tr>
              <th className="px-4 py-3 text-left">Замовлення</th>
              <th className="px-4 py-3 text-left">Об&apos;єкт</th>
              <th className="border-l border-slate-200/90 bg-sky-50/60 px-3 py-3 text-right text-sky-900" title="Сума договору по замовленню">
                Заг. варт.
              </th>
              <th className="bg-emerald-50/50 px-3 py-3 text-right text-emerald-900" title="Надходження готівкою">
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
                  <Link
                    href={`/crm/finance/${r.projectId}`}
                    className="inline-flex rounded-md px-1 py-0.5 text-xs font-semibold text-sky-700 underline-offset-2 transition hover:bg-sky-50 hover:text-sky-900 hover:underline"
                    title="Відкрити фінансовий кабінет замовлення"
                  >
                    {deriveOrderNumber(r)}
                  </Link>
                </td>
                <td className="px-4 py-3 align-top text-slate-800">
                  <span className="font-medium">{deriveObjectTitle(r)}</span>
                  <p className="mt-0.5 max-w-[14rem] text-xs leading-relaxed text-slate-500">{r.objectAddress}</p>
                </td>
                <td className="border-l border-slate-100 bg-sky-50/30 px-3 py-3 text-right tabular-nums text-sky-900">{formatMoneyUa(r.orderTotalAmount)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-emerald-800">{formatMoneyUa(r.incomeCash)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-rose-800">{formatMoneyUa(r.expenseCash)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-amber-900">{formatMoneyUa(r.payrollCash)}</td>
                <td className="border-r border-slate-100 px-3 py-3 text-right tabular-nums text-violet-900">{formatMoneyUa(r.commissionCash)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-700">{formatMoneyUa(r.procurementPlanned)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-800">{formatMoneyUa(r.procurementAccrual)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-amber-950">{formatMoneyUa(r.payrollAccrued)}</td>
                <td className="border-r border-slate-100 px-3 py-3 text-right tabular-nums text-rose-900">{formatMoneyUa(r.openPurchaseOrders)}</td>
                <td className="px-4 py-3 align-top">
                  <Link
                    href={`/crm/finance/${r.projectId}`}
                    className="text-xs font-medium text-sky-700 underline-offset-2 hover:text-sky-900 hover:underline"
                  >
                    Відкрити фінкабінет
                  </Link>
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-300 bg-gradient-to-r from-slate-100 to-slate-50 font-semibold">
              <td className="px-4 py-3 text-slate-900" colSpan={2}>
                <span className="text-xs text-slate-500">Підсумок</span>
                <p className="text-sm text-slate-900">{consolidated.projectTitle} — {consolidated.objectTitle}</p>
              </td>
              <td className="border-l border-slate-200 bg-sky-50/40 px-3 py-3 text-right tabular-nums text-sky-950">{formatMoneyUa(consolidated.orderTotalAmount)}</td>
              <td className="px-3 py-3 text-right tabular-nums text-emerald-900">{formatMoneyUa(consolidated.incomeCash)}</td>
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
