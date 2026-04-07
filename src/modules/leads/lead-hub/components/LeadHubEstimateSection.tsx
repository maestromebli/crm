"use client";

import Link from "next/link";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import type { LeadDetailRow } from "../../../../features/leads/queries";
import { cn } from "../../../../lib/utils";

function formatUah(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return (
    new Intl.NumberFormat("uk-UA", {
      maximumFractionDigits: n % 1 === 0 ? 0 : 2,
    }).format(n) + " грн"
  );
}

type Props = {
  lead: LeadDetailRow;
  canViewEstimates: boolean;
};

export function LeadHubEstimateSection({ lead, canViewEstimates }: Props) {
  if (!canViewEstimates) return null;

  const versions = [...lead.estimates].sort((a, b) => b.version - a.version);
  const activeId = lead.activeEstimateId;

  return (
    <section
      id="lead-estimates"
      className="enver-card-appear rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-card)] p-4 shadow-[var(--enver-shadow)]"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-medium text-[var(--enver-text)]">
          Розрахунок вартості
        </h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
          <Link
            href={`/leads/${lead.id}/pricing`}
            className="font-medium text-[var(--enver-accent)] hover:underline"
          >
            Розрахунок
          </Link>
          <Link
            href={`/leads/${lead.id}/kp`}
            className="text-[var(--enver-muted)] hover:text-[var(--enver-text)]"
          >
            КП
          </Link>
        </div>
      </div>

      {versions.length === 0 ? (
        <p className="mt-4 text-[14px] text-[var(--enver-muted)]">Ще немає версій смети.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {versions.map((e) => {
            const isActive = activeId === e.id;
            return (
              <li
                key={e.id}
                className={cn(
                  "enver-hover-lift rounded-[12px] border px-3 py-2.5 transition duration-200",
                  isActive
                    ? "border-[#2563EB] bg-[var(--enver-accent-soft)]"
                    : "border-[var(--enver-border)] bg-[var(--enver-bg)]",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[14px] font-medium text-[var(--enver-text)]">
                    v{e.version}
                    {e.name ? ` · ${e.name}` : ""}
                  </span>
                  {isActive ? (
                    <span className="rounded-full bg-[#2563EB] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Активна
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[18px] font-semibold text-[var(--enver-text)]">
                  {formatUah(e.totalPrice)}
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--enver-muted)]">
                  {e.status} · оновлено{" "}
                  {format(new Date(e.updatedAt), "d MMM yyyy, HH:mm", {
                    locale: uk,
                  })}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
