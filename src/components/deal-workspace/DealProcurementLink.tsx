"use client";

import Link from "next/link";
import { buildProcurementHubHref, buildProcurementHubNewRequestHref } from "@/features/procurement/lib/quick-actions";

type Props = {
  dealId: string;
};

/** Швидкі посилання в модуль закупівель по поточній угоді. */
export function DealProcurementLink({ dealId }: Props) {
  return (
    <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/55 px-3 py-2 text-sm shadow-sm shadow-slate-900/5">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900/90">
        Закупівлі
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[12px]">
        <Link
          href={`/crm/procurement/${dealId}`}
          className="font-medium text-emerald-950 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900"
        >
          Закупівлі по угоді
        </Link>
        <span className="text-emerald-800/50" aria-hidden>
          ·
        </span>
        <Link
          href={buildProcurementHubNewRequestHref(dealId)}
          className="text-emerald-900/95 underline decoration-emerald-300/80 underline-offset-2 hover:text-emerald-950"
        >
          Нова заявка
        </Link>
        <span className="text-emerald-800/50" aria-hidden>
          ·
        </span>
        <Link
          href={buildProcurementHubHref()}
          className="text-emerald-800/90 underline decoration-emerald-300/60 underline-offset-2 hover:text-emerald-950"
        >
          Операційний hub
        </Link>
      </div>
    </div>
  );
}
