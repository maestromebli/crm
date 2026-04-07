"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "../../../../lib/utils";

const btnPrimary =
  "rounded-lg border border-blue-700 bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50";
const btnGhost =
  "rounded-lg border border-slate-200 bg-[var(--enver-card)] px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-[var(--enver-hover)] disabled:opacity-50";

type Props = {
  newVersionLabel: string;
  draftBadge: boolean;
  projectTitle: string;
  onDuplicate: () => void;
  onCreate: () => void;
  onCreateProposal: () => void;
  moreMenu: React.ReactNode;
  leadId: string;
};

export function EstimateVersionHeader({
  newVersionLabel,
  draftBadge,
  projectTitle,
  onDuplicate,
  onCreate,
  onCreateProposal,
  moreMenu,
  leadId,
}: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-[var(--enver-card)]">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-3 px-4 py-3 md:flex-row md:items-start md:justify-between md:px-6 md:py-4">
        <div className="min-w-0 flex-1">
          <Link
            href={`/leads/${leadId}`}
            className="text-[11px] font-medium text-blue-700 hover:underline"
          >
            ← Лід
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-[var(--enver-text)] md:text-2xl">
              {newVersionLabel}
            </h1>
            {draftBadge ? (
              <span className="rounded-md bg-orange-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-orange-900">
                Чернетка
              </span>
            ) : null}
          </div>
          {/* Вигляд «селектора проєкту» як на референсі */}
          <div className="mt-3 max-w-md">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Проєкт
            </p>
            <div className="flex cursor-default items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50/90 px-3 py-2 text-sm font-medium text-slate-800 shadow-inner">
              <span className="truncate">{projectTitle}</span>
              <span className="shrink-0 text-slate-400" aria-hidden>
                ▾
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 md:pt-6">
          <button type="button" className={btnGhost} onClick={onDuplicate}>
            Дублювати
          </button>
          <button type="button" className={btnGhost} onClick={onCreate}>
            Створити
          </button>
          <button type="button" className={btnPrimary} onClick={onCreateProposal}>
            Створити КП
          </button>
          {moreMenu}
        </div>
      </div>
    </header>
  );
}

export function EstimateVersionMetricsStrip({
  updatedAtIso,
  subtotal,
  discountAmount,
  discountPct,
  total,
  marginPct,
  marginLow,
}: {
  updatedAtIso: string;
  subtotal: number;
  discountAmount: number;
  discountPct: number | null;
  total: number;
  marginPct: number | null;
  marginLow: boolean;
}) {
  const updated = new Date(updatedAtIso);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const mins = Math.floor((now - updated.getTime()) / 60000);
  const updatedText =
    mins < 1
      ? "щойно"
      : mins < 60
        ? `${mins} хв тому`
        : `${Math.floor(mins / 60)} год тому`;

  return (
    <div className="border-b border-slate-200 bg-[#f4f7fb] px-4 py-2.5 text-[11px] text-slate-600 md:px-6">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-4 gap-y-1">
        <span>
          Оновлено <span className="font-semibold text-slate-800">{updatedText}</span>
        </span>
        <span className="text-slate-300">|</span>
        <span>
          Підсумок позицій:{" "}
          <span className="font-semibold tabular-nums text-[var(--enver-text)]">
            {subtotal.toLocaleString("uk-UA")} грн
          </span>
        </span>
        <span className="text-slate-300">|</span>
        <span>
          Знижка:{" "}
          {discountPct != null ? (
            <span className="font-semibold">{discountPct}%</span>
          ) : (
            <span className="font-semibold tabular-nums">
              {discountAmount.toLocaleString("uk-UA")} грн
            </span>
          )}
        </span>
        <span className="text-slate-300">|</span>
        <span>
          Разом:{" "}
          <span className="text-base font-bold tabular-nums text-emerald-700">
            {total.toLocaleString("uk-UA")} грн
          </span>
        </span>
        <span className="text-slate-300">|</span>
        <span
          className={cn(
            "whitespace-nowrap",
            marginLow ? "text-amber-800" : "text-slate-800",
          )}
        >
          Маржа:{" "}
          <span className="font-bold tabular-nums">
            {marginPct != null ? `${marginPct}%` : "—"}
          </span>
          {marginLow ? (
            <span className="ml-1 text-[10px] font-semibold text-amber-700">
              (низька)
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}
