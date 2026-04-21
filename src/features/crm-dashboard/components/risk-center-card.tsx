import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import type { RiskRow, RiskType } from "../executive-types";
import { cn } from "../../../lib/utils";

type RiskCenterCardProps = {
  rows: RiskRow[];
};

const riskLabel: Record<RiskType, string> = {
  payment: "Оплата",
  deadline: "Дедлайн",
  margin: "Маржа",
  supplier_delay: "Постачання",
  production_delay: "Виробництво",
};

export function RiskCenterCard({ rows }: RiskCenterCardProps) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-5">
        <h2 className="text-sm font-semibold text-[var(--enver-text)]">
          Ризик-центр
        </h2>
        <p className="mt-2 text-sm text-[var(--enver-text-muted)]">
          Поки без критичних ризиків у видимості.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-5 shadow-[var(--enver-shadow)]">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-rose-500" aria-hidden />
        <h2 className="text-sm font-semibold text-[var(--enver-text)]">
          Ризик-центр
        </h2>
      </div>
      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li key={r.id}>
            <div className="flex items-start justify-between gap-2 rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)]/60 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--enver-text)]">
                  {r.name}
                </p>
                <p className="text-xs text-[var(--enver-text-muted)]">{r.reason}</p>
                <span className="mt-1 inline-block rounded-md bg-[var(--enver-bg)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--enver-muted)]">
                  {riskLabel[r.riskType]}
                </span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
                    r.score >= 75
                      ? "bg-rose-100 text-rose-800"
                      : r.score >= 50
                        ? "bg-amber-100 text-amber-900"
                        : "border border-[var(--enver-border)] bg-[var(--enver-surface)] text-[var(--enver-text)]",
                  )}
                >
                  {r.score}
                </span>
                <Link
                  href={r.href}
                  className="text-[11px] font-semibold text-[var(--enver-accent)] underline-offset-2 hover:text-[var(--enver-accent-hover)] hover:underline"
                >
                  Відкрити
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
