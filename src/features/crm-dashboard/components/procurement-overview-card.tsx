import Link from "next/link";
import { Package } from "lucide-react";
import type { ProcurementOverview } from "../executive-types";

type ProcurementOverviewCardProps = {
  data: ProcurementOverview | null;
};

export function ProcurementOverviewCard({
  data,
}: ProcurementOverviewCardProps) {
  if (!data) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--enver-border)] bg-[var(--enver-surface)]/40 p-5 text-sm text-[var(--enver-text-muted)]">
        Закупівлі недоступні за вашими правами.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-5 shadow-[var(--enver-shadow)]">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-[var(--enver-accent)]" />
        <h2 className="text-sm font-semibold text-[var(--enver-text)]">
          Закупівлі
        </h2>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Cell label="Активні PO" value={data.pendingOrders} />
        <Cell label="Затримки постачальників" value={data.supplierDelays} warn />
        <Cell label="Низький залишок" value={data.lowStockMaterials} />
        <Cell label="Поставки цього тижня" value={data.deliveriesThisWeek} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/crm/procurement"
          className="rounded-lg bg-[var(--enver-accent)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:brightness-110"
        >
          Закупівлі
        </Link>
        <Link
          href="/crm/procurement"
          className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--enver-hover)]"
        >
          Створити PO
        </Link>
        <Link
          href="/crm/procurement"
          className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--enver-hover)]"
        >
          Затримки
        </Link>
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  warn,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] px-3 py-2">
      <p className="text-[11px] text-[var(--enver-muted)]">{label}</p>
      <p
        className={`text-lg font-semibold tabular-nums ${warn ? "text-amber-700" : "text-[var(--enver-text)]"}`}
      >
        {value}
      </p>
    </div>
  );
}
