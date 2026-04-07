import Link from "next/link";
import { Wallet } from "lucide-react";
import type { FinanceOverview } from "../executive-types";
import { cn } from "../../../lib/utils";

type FinanceOverviewCardProps = {
  data: FinanceOverview | null;
  financeRange: string;
};

export function FinanceOverviewCard({
  data,
  financeRange,
}: FinanceOverviewCardProps) {
  if (!data) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--enver-border)] bg-[var(--enver-surface)]/40 p-5">
        <p className="text-sm text-[var(--enver-text-muted)]">
          Фінансовий блок недоступний за правами або без даних.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-5 shadow-[var(--enver-shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-[var(--enver-accent)]" />
          <h2 className="text-sm font-semibold text-[var(--enver-text)]">
            Фінанси
          </h2>
        </div>
        <span className="text-[11px] text-[var(--enver-muted)]">
          період: {financeRange}
        </span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Mini
          label="Оплати сьогодні"
          value={`${Math.round(data.paymentsToday).toLocaleString("uk-UA")} ₴`}
        />
        <Mini
          label="Прострочені оплати"
          value={`${Math.round(data.paymentsOverdue).toLocaleString("uk-UA")} ₴`}
          warn
        />
        <Mini
          label="Витрати місяця"
          value={`${Math.round(data.expensesMonth).toLocaleString("uk-UA")} ₴`}
        />
      </div>
      <div className="mt-4">
        <p className="text-[11px] font-medium uppercase text-[var(--enver-muted)]">
          Топ неоплачених рахунків
        </p>
        <ul className="mt-2 space-y-1">
          {data.topUnpaidInvoices.length === 0 ? (
            <li className="text-sm text-[var(--enver-text-muted)]">
              Немає рахунків у статусі «Надіслано».
            </li>
          ) : (
            data.topUnpaidInvoices.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--enver-border)] px-2 py-1.5 text-sm"
              >
                <Link
                  href={`/deals/${inv.dealId}`}
                  className="truncate font-medium text-[var(--enver-text)] hover:underline"
                >
                  {inv.dealTitle}
                </Link>
                <span className="shrink-0 tabular-nums text-xs text-[var(--enver-text-muted)]">
                  {Math.round(inv.amount).toLocaleString("uk-UA")} ₴ ·{" "}
                  {inv.daysOverdue} д
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
      <div className="mt-4">
        <p className="text-[11px] font-medium uppercase text-[var(--enver-muted)]">
          Маржа по угодах
        </p>
        <ul className="mt-2 space-y-1">
          {data.marginByDeal.map((d) => (
            <li
              key={d.dealId}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <Link
                href={`/deals/${d.dealId}`}
                className="truncate hover:underline"
              >
                {d.title}
              </Link>
              <span className="shrink-0 tabular-nums text-[var(--enver-text-muted)]">
                {d.marginPct != null ? `${d.marginPct}%` : "—"}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--enver-border)] pt-4">
        <Link
          href="/crm/finance"
          className={cn(
            "rounded-lg bg-[var(--enver-accent)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm",
            "hover:brightness-110",
          )}
        >
          Відкрити фінанси
        </Link>
        <Link
          href="/crm/finance"
          className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--enver-text)] hover:bg-[var(--enver-hover)]"
        >
          Переглянути прострочення
        </Link>
      </div>
    </div>
  );
}

function Mini({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2",
        warn
          ? "border-rose-200 bg-rose-50/70"
          : "border-[var(--enver-border)] bg-[var(--enver-surface)]",
      )}
    >
      <p className="text-[11px] text-[var(--enver-muted)]">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-sm font-semibold tabular-nums",
          warn ? "text-rose-800" : "text-[var(--enver-text)]",
        )}
      >
        {value}
      </p>
    </div>
  );
}
