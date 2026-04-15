"use client";

import type { DealFinanceSummary } from "../../features/deal-workspace/deal-view-selectors";

type Props = {
  finance: DealFinanceSummary;
};

export function DealFinanceCard({ finance }: Props) {
  return (
    <section className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
        Фінанси угоди
      </h3>
      {finance.hasNumeric ? (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] text-[var(--enver-muted)]">Загалом</p>
            <p className="text-sm font-semibold text-[var(--enver-text)]">
              {finance.total.toLocaleString("uk-UA")} {finance.currency ?? ""}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-emerald-700">Оплачено</p>
            <p className="text-sm font-semibold text-emerald-900">
              {finance.paid.toLocaleString("uk-UA")}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-amber-800">Залишок</p>
            <p className="text-sm font-semibold text-amber-900">
              {finance.remaining.toLocaleString("uk-UA")}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-[var(--enver-text-muted)]">Суми по віхах ще не задані.</p>
      )}
      <p className="mt-3 text-xs text-[var(--enver-text-muted)]">
        Найближчий платіж: <span className="font-medium text-[var(--enver-text)]">{finance.nextPaymentLabel}</span>
      </p>
      <p className="mt-1.5 text-xs text-[var(--enver-text-muted)]">
        Дата оплати:{" "}
        <span className="font-medium text-[var(--enver-text)]">
          {finance.nextPaymentDueAtLabel ?? "не вказана"}
        </span>
      </p>
    </section>
  );
}
