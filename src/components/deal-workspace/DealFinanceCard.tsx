"use client";

import { useMemo } from "react";
import type { DealFinanceSummary } from "../../features/deal-workspace/deal-view-selectors";

type Props = {
  finance: DealFinanceSummary;
  paymentMilestones: Array<{
    label: string | null;
    amount: number | null;
    currency: string | null;
    sortOrder: number;
  }>;
};

export function DealFinanceCard({ finance, paymentMilestones }: Props) {
  const paymentBreakdown = useMemo(() => {
    const sorted = [...paymentMilestones].sort((a, b) => a.sortOrder - b.sortOrder);
    const primaryCurrency =
      sorted.find((item) => item.currency)?.currency ?? finance.currency ?? "";
    const advance = sorted[0]?.amount ?? 0;
    const topUp =
      sorted[1]?.amount ??
      Math.max(0, Number.isFinite(finance.total) ? finance.total - advance : 0);
    return {
      currency: primaryCurrency,
      advance,
      topUp,
    };
  }, [finance.currency, finance.total, paymentMilestones]);
  const isFullyPaid = finance.hasNumeric && finance.remaining <= 0;

  return (
    <section className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
        Фінанси замовлення
      </h3>
      {finance.hasNumeric ? (
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div>
            <p className="text-[10px] text-[var(--enver-muted)]">Загальна вартість</p>
            <p className="text-sm font-semibold text-[var(--enver-text)]">
              {finance.total.toLocaleString("uk-UA")} {paymentBreakdown.currency}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-emerald-700">Аванс</p>
            <p className="text-sm font-semibold text-emerald-900">
              {paymentBreakdown.advance.toLocaleString("uk-UA")} {paymentBreakdown.currency}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-amber-800">Доплата</p>
            <p className="text-sm font-semibold text-amber-900">
              {paymentBreakdown.topUp.toLocaleString("uk-UA")} {paymentBreakdown.currency}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] py-2">
            <p className="text-[10px] text-[var(--enver-muted)]">
              {isFullyPaid ? "Статус оплати" : "Залишок до оплати"}
            </p>
            <p className="text-sm font-semibold text-[var(--enver-text)]">
              {isFullyPaid
                ? "Повна оплата"
                : `${finance.remaining.toLocaleString("uk-UA")} ${paymentBreakdown.currency}`}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-[var(--enver-text-muted)]">Суми по віхах ще не задані.</p>
      )}
    </section>
  );
}
