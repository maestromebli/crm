"use client";

import Link from "next/link";
import { cn } from "../../../../lib/utils";

export type VersionRow = {
  id: string;
  version: number;
  status: string;
  totalPrice: number | null;
  changeSummary: string | null;
  updatedAt: string;
};

type Props = {
  items: VersionRow[];
  leadId: string;
  activeEstimateId: string | null;
  highlightVersion?: number;
};

function statusLabel(status: string) {
  if (status === "SUPERSEDED") return "архів";
  if (status === "DRAFT") return "чернетка";
  return status.toLowerCase();
}

export function VersionHistoryCard({
  items,
  leadId,
  activeEstimateId,
  highlightVersion,
}: Props) {
  return (
    <section className="rounded-xl border border-slate-200/90 bg-[var(--enver-card)] p-4 shadow-sm">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        Історія версій
      </h3>
      <div className="relative mt-3 max-h-56 space-y-3 overflow-y-auto pl-6">
        <div
          className="absolute bottom-1 left-[7px] top-1 w-px bg-slate-200"
          aria-hidden
        />
        <ul className="space-y-3 text-[11px]">
          {items.map((v) => {
            const active = activeEstimateId === v.id;
            const highlight = highlightVersion === v.version;
            return (
              <li key={v.id} className="relative">
                <span
                  className={cn(
                    "absolute left-[-19px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white shadow-sm",
                    active ? "bg-emerald-500" : "bg-slate-300",
                  )}
                />
                <div
                  className={cn(
                    "rounded-lg border p-2",
                    highlight
                      ? "border-blue-300 bg-blue-50/80"
                      : "border-slate-100 bg-slate-50/80",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[var(--enver-text)]">
                      v{v.version}
                      <span className="ml-1.5 font-normal text-slate-600">
                        · {statusLabel(v.status)}
                        {active ? " · активна" : ""}
                      </span>
                    </span>
                    <span className="tabular-nums font-semibold text-slate-700">
                      {v.totalPrice != null
                        ? `${v.totalPrice.toLocaleString("uk-UA")} грн`
                        : "—"}
                    </span>
                  </div>
                  {v.changeSummary ? (
                    <p className="mt-1 text-[10px] text-slate-500">
                      {v.changeSummary}
                    </p>
                  ) : null}
                  <Link
                    href={`/leads/${leadId}/estimate/${v.id}`}
                    className="mt-1 inline-block text-[10px] font-semibold text-blue-700 hover:underline"
                  >
                    Відкрити </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
