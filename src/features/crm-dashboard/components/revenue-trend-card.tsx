"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "../../../lib/utils";
import type { TrendMetric, TrendPoint, TrendRange } from "../executive-types";

type RevenueTrendCardProps = {
  points: TrendPoint[];
  trendRange: TrendRange;
  metric: TrendMetric;
  basePath?: string;
};

const RANGE_TABS: { id: TrendRange; label: string }[] = [
  { id: "7d", label: "7 днів" },
  { id: "30d", label: "30 днів" },
  { id: "90d", label: "90 днів" },
  { id: "year", label: "Рік" },
];

const METRIC_TABS: { id: TrendMetric; label: string }[] = [
  { id: "revenue", label: "Виручка" },
  { id: "payments", label: "Оплати" },
  { id: "gross_profit", label: "Валовий прибуток" },
  { id: "expenses", label: "Витрати" },
];

function metricValue(p: TrendPoint, m: TrendMetric): number {
  switch (m) {
    case "revenue":
      return p.revenue;
    case "payments":
      return p.payments;
    case "gross_profit":
      return p.grossProfit;
    case "expenses":
      return p.expenses;
    default:
      return 0;
  }
}

export function RevenueTrendCard({
  points,
  trendRange,
  metric,
  basePath = "/crm/dashboard",
}: RevenueTrendCardProps) {
  const sp = useSearchParams();
  const max = useMemo(
    () => Math.max(1, ...points.map((p) => metricValue(p, metric))),
    [points, metric],
  );

  const qs = (extra: Record<string, string>) => {
    const u = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(extra)) u.set(k, v);
    return `${basePath}?${u.toString()}`;
  };

  return (
    <div className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-5 shadow-[var(--enver-shadow)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--enver-text)]">
            Динаміка
          </h2>
          <p className="text-[11px] text-[var(--enver-muted)]">
            Інтерактивний графік (період і метрика через URL)
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {RANGE_TABS.map((t) => (
            <Link
              key={t.id}
              href={qs({ trendRange: t.id })}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                trendRange === t.id
                  ? "bg-[var(--enver-accent)] text-white shadow-sm"
                  : "bg-[var(--enver-surface)] text-[var(--enver-text-muted)] hover:bg-[var(--enver-hover)]",
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 border-b border-[var(--enver-border)] pb-3">
        {METRIC_TABS.map((t) => (
          <Link
            key={t.id}
            href={qs({ metric: t.id })}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
              metric === t.id
                ? "bg-[var(--enver-surface)] text-[var(--enver-text)] ring-1 ring-[var(--enver-border-strong)]"
                : "text-[var(--enver-text-muted)] hover:text-[var(--enver-text)]",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <div className="mt-4 flex h-44 items-end gap-0.5 overflow-x-auto pb-1">
        {points.length === 0 ? (
          <p className="text-sm text-[var(--enver-text-muted)]">
            Немає точок за період.
          </p>
        ) : (
          points.map((p) => {
            const v = metricValue(p, metric);
            const h = Math.round((v / max) * 100);
            return (
              <div
                key={p.date}
                className="flex min-w-[20px] flex-1 flex-col items-center justify-end gap-1"
                title={`${p.label}: ${Math.round(v).toLocaleString("uk-UA")} ₴`}
              >
                <div
                  className="w-full max-w-[14px] rounded-t-md bg-[var(--enver-accent)]/85"
                  style={{ height: `${Math.max(8, h)}%` }}
                />
                <span className="max-w-full truncate text-[9px] text-[var(--enver-muted)]">
                  {p.label}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
