"use client";

import Link from "next/link";
import { Calculator, ChevronRight } from "lucide-react";
import type { LeadDetailRow } from "../../../features/leads/queries";

function formatUah(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return (
    new Intl.NumberFormat("uk-UA", {
      maximumFractionDigits: n % 1 === 0 ? 0 : 2,
    }).format(n) + " грн"
  );
}

export function LeadPricingSummaryCard({
  lead,
  canViewEstimates,
}: {
  lead: LeadDetailRow;
  canViewEstimates: boolean;
}) {
  if (!canViewEstimates) return null;

  const latest = lead.estimates[0];
  const sub =
    latest != null
      ? `v${latest.version} · ${formatUah(latest.totalPrice)} · ${latest.status}`
      : "Ще немає версії смети";

  return (
    <div
      id="lead-commercial"
      className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-800">
            <Calculator className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--enver-text)]">
              Розрахунок вартості
            </h3>
            <p className="mt-0.5 text-xs text-slate-600">{sub}</p>
          </div>
        </div>
        <Link
          href={`/leads/${lead.id}/pricing`}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
        >
          Відкрити
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
