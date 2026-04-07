"use client";

import Link from "next/link";
import type { LeadDetailRow } from "../../../features/leads/queries";

type LeadActionsProps = {
  lead: LeadDetailRow;
  tel: string | null;
  canConvertToDeal: boolean;
  converting: boolean;
  onConvert: () => void;
  onCallNavigate: () => void;
};

export function LeadActions({
  lead,
  tel,
  canConvertToDeal,
  converting,
  onConvert,
  onCallNavigate,
}: LeadActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tel ? (
        <a
          href={tel}
          onClick={() => onCallNavigate()}
          className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
        >
          Дзвінок
        </a>
      ) : (
        <span className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-400">
          Немає телефону
        </span>
      )}
      <Link
        href={`/leads/${lead.id}/messages`}
        className="rounded-full border border-slate-200 bg-[var(--enver-card)] px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-[var(--enver-hover)]"
      >
        Діалог
      </Link>
      <Link
        href={`/leads/${lead.id}/tasks?new=1`}
        className="rounded-full border border-slate-200 bg-[var(--enver-card)] px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-[var(--enver-hover)]"
      >
        Задача
      </Link>
      {lead.linkedDeal ? (
        <Link
          href={`/deals/${lead.linkedDeal.id}/workspace`}
          className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
        >
          Відкрити угоду
        </Link>
      ) : canConvertToDeal ? (
        <button
          type="button"
          disabled={converting}
          onClick={() => onConvert()}
          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-[var(--enver-hover)] disabled:opacity-50"
        >
          {converting ? "…" : "У угоду"}
        </button>
      ) : null}
    </div>
  );
}
