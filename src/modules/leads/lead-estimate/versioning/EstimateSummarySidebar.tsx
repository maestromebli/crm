"use client";

import { cn } from "../../../../lib/utils";

type Props = {
  subtotal: number;
  discountAmount: number;
  discountPct: number | null;
  total: number;
  marginPct: number | null;
  marginLow: boolean;
  newVersion: number;
  newTotal: number | null;
  prevVersion: number;
  prevTotal: number | null;
  prevNote?: string | null;
};

export function EstimateSummarySidebar({
  subtotal,
  discountAmount,
  discountPct,
  total,
  marginPct,
  marginLow,
  newVersion,
  newTotal,
  prevVersion,
  prevTotal,
  prevNote,
}: Props) {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200/90 bg-[var(--enver-card)] p-4 shadow-sm">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Підсумок (нова версія)
        </h3>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-600">Підсумок позицій</dt>
            <dd className="font-semibold tabular-nums">{subtotal.toLocaleString("uk-UA")}</dd>
          </div>
          <div className="flex justify-between gap-2 text-[11px]">
            <dt className="text-slate-500">Знижка</dt>
            <dd>
              {discountPct != null
                ? `${discountPct}%`
                : `${discountAmount.toLocaleString("uk-UA")} грн`}
            </dd>
          </div>
          <div className="flex justify-between gap-2 border-t border-slate-200 pt-2">
            <dt className="font-bold text-[var(--enver-text)]">Разом</dt>
            <dd className="text-lg font-bold tabular-nums text-emerald-700">
              {total.toLocaleString("uk-UA")} грн
            </dd>
          </div>
          <div
            className={cn(
              "flex justify-between gap-2 rounded-lg px-2 py-1.5 text-[11px]",
              marginLow ? "bg-amber-50 text-amber-950" : "bg-emerald-50 text-emerald-900",
            )}
          >
            <dt className="font-semibold">Маржа</dt>
            <dd className="font-bold tabular-nums">
              {marginPct != null ? `${marginPct}%` : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200/90 bg-[var(--enver-card)] p-4 shadow-sm">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Версії
        </h3>
        <div className="mt-3 space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
          <p className="text-[10px] font-bold uppercase text-emerald-900">
            Нова (перегляд)
          </p>
          <p className="text-sm font-bold text-[var(--enver-text)]">
            v{newVersion} · чернетка
          </p>
          <p className="text-lg font-bold tabular-nums text-emerald-800">
            {newTotal != null ? `${newTotal.toLocaleString("uk-UA")} грн` : "—"}
          </p>
        </div>
        <div className="mt-3 space-y-1 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
          <p className="text-[10px] font-bold uppercase text-slate-600">
            Попередня поточна
          </p>
          <p className="text-sm font-bold text-slate-800">
            v{prevVersion} · архів після підтвердження
          </p>
          <p className="text-base font-semibold tabular-nums text-slate-700">
            {prevTotal != null ? `${prevTotal.toLocaleString("uk-UA")} грн` : "—"}
          </p>
          {prevNote ? (
            <p className="text-[10px] text-slate-500">{prevNote}</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
