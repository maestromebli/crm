"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Sparkles,
  AlertTriangle,
  ListChecks,
  Clock,
  Link2,
  Zap,
} from "lucide-react";
import { deriveDealRailMicroHints } from "../../features/deal-workspace/deal-workspace-warnings";
import type { DealWorkspacePayload } from "../../features/deal-workspace/types";
import {
  deriveDealPrimaryCta,
  contractStatusShortUa,
} from "../../features/deal-workspace/next-cta";
import { derivePaymentMoneySummaryForPayload } from "../../features/deal-workspace/payment-aggregate";
import { cn } from "../../lib/utils";

type Props = {
  data: DealWorkspacePayload;
  nextBestAction: string;
  aiSummary: string;
};

export function DealRightRail({ data, nextBestAction, aiSummary }: Props) {
  const microHints = useMemo(() => deriveDealRailMicroHints(data), [data]);
  const blockers = data.readiness.filter((c) => !c.done);
  const primaryCta = useMemo(() => deriveDealPrimaryCta(data), [data]);
  const fin = useMemo(() => derivePaymentMoneySummaryForPayload(data), [data]);

  return (
    <aside className="flex w-full flex-col gap-3 lg:w-80 lg:shrink-0">
      <div className="rounded-2xl border border-slate-900 bg-slate-900 p-3 text-xs text-white shadow-md">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Наступний крок (CRM)
        </p>
        <p className="font-medium leading-snug">{primaryCta.label}</p>
        {primaryCta.disabledReason ? (
          <p className="mt-2 text-[11px] text-amber-200/90">{primaryCta.disabledReason}</p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs shadow-sm">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-900">
          Фінанси стисло
        </p>
        {fin.hasNumeric ? (
          <ul className="space-y-1 text-emerald-950">
            <li>
              Загалом:{" "}
              <span className="font-semibold">
                {fin.total.toLocaleString("uk-UA")} {fin.currency ?? ""}
              </span>
            </li>
            <li>
              Оплачено:{" "}
              <span className="font-semibold">
                {fin.paid.toLocaleString("uk-UA")}
              </span>
            </li>
            <li>
              Залишок:{" "}
              <span className="font-semibold">
                {fin.remaining.toLocaleString("uk-UA")}
              </span>
            </li>
          </ul>
        ) : (
          <p className="text-emerald-900/80">Віхи суми не задані.</p>
        )}
        <p className="mt-2 border-t border-emerald-200/80 pt-2 text-[11px] text-emerald-900/90">
          Договір: {contractStatusShortUa(data.contract?.status ?? null)}
        </p>
      </div>

      <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-3 text-xs shadow-sm">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-800">
          <Sparkles className="h-3.5 w-3.5" />
          AI-огляд
        </div>
        <p className="leading-relaxed text-slate-700">{aiSummary}</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-3 text-xs shadow-sm">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Рекомендація CRM
        </p>
        <p className="font-medium text-[var(--enver-text)]">{nextBestAction}</p>
      </div>

      {microHints.length > 0 ? (
        <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-3 text-xs shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-900">
            <Zap className="h-3.5 w-3.5" />
            Операційні сигнали
          </div>
          <ul className="space-y-1.5 text-[11px] leading-snug text-slate-800">
            {microHints.map((line, i) => (
              <li key={`${i}-${line.slice(0, 48)}`} className="flex gap-1.5">
                <span className="text-violet-600" aria-hidden>
                  ·
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {blockers.length > 0 ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-3 text-xs shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5" />
            Ризики / блокери
          </div>
          <ul className="space-y-1.5">
            {blockers.map((b) => (
              <li key={b.id} className="text-slate-800">
                <span className="font-medium">{b.label}</span>
                {b.blockerMessage ? (
                  <span className="mt-0.5 block text-[11px] text-slate-600">
                    {b.blockerMessage}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-3 text-xs shadow-sm">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          <ListChecks className="h-3.5 w-3.5" />
          Готовність до виробництва
        </div>
        <p className="mb-2 text-[11px] text-slate-600">
          Виконано:{" "}
          {data.readiness.filter((c) => c.done).length}/{data.readiness.length}
        </p>
        {data.lastReadinessSnapshotAt ? (
          <p className="mb-2 text-[11px] text-slate-500">
            Останній знімок у БД:{" "}
            {new Date(data.lastReadinessSnapshotAt).toLocaleString("uk-UA", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
        ) : (
          <p className="mb-2 text-[11px] text-slate-500">
            Знімки готовності зʼявляться після змін (мета, договір, файли).
          </p>
        )}
        <ul className="space-y-1">
          {data.readiness.map((c) => (
            <li
              key={c.id}
              className={cn(
                "flex items-start gap-2 text-[11px]",
                c.done ? "text-emerald-800" : "text-slate-600",
              )}
            >
              <span>{c.done ? "✓" : "○"}</span>
              <span>{c.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-[11px] text-slate-600">
        <div className="mb-2 flex items-center gap-2 font-semibold uppercase tracking-[0.14em] text-slate-500">
          <Link2 className="h-3.5 w-3.5" />
          Звʼязки
        </div>
        {data.leadId ? (
          <p>
            Лід:{" "}
            <Link
              href={`/leads/${data.leadId}`}
              className="font-medium text-[var(--enver-text)] underline"
            >
              відкрити
            </Link>
          </p>
        ) : (
          <p>Лід не привʼязаний</p>
        )}
        <p className="mt-1">
          Клієнт:{" "}
          <span className="font-medium text-slate-800">{data.client.name}</span>
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-[var(--enver-card)] px-3 py-2 text-[11px] text-slate-600">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        Оновлено:{" "}
        {new Date(data.deal.updatedAt).toLocaleString("uk-UA", {
          dateStyle: "short",
          timeStyle: "short",
        })}
      </div>
    </aside>
  );
}
