"use client";

import Link from "next/link";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { Calculator, Sparkles } from "lucide-react";
import type { LeadDetailRow } from "../../../../features/leads/queries";
import {
  computeLeadRisks,
  getLeadDominantNextStep,
  mapLeadDetailRowToCoreInput,
} from "../../../../lib/crm-core";
import { deriveLeadSalesHint } from "../../../../lib/leads/lead-sales-hints";
import { normalizePhoneDigits } from "../../../../lib/leads/phone-normalize";
import { cn } from "../../../../lib/utils";

function telHref(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const t = phone.trim();
  if (t.startsWith("+")) return `tel:${t.replace(/\s/g, "")}`;
  const d = normalizePhoneDigits(t);
  if (d.length < 9) return null;
  return `tel:+${d}`;
}

function formatUah(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return (
    new Intl.NumberFormat("uk-UA", {
      maximumFractionDigits: n % 1 === 0 ? 0 : 2,
    }).format(n) + " грн"
  );
}

export type LeadHubHeaderProps = {
  lead: LeadDetailRow;
  canUpdateLead: boolean;
  canConvertToDeal: boolean;
  quickStageId: string;
  stageBusy: boolean;
  onStageChange: (stageId: string) => void;
  onRecordCall: () => void;
  onScheduleMeasurement: () => void;
  onConvertClick: () => void;
  converting: boolean;
  canViewEstimates?: boolean;
};

export function LeadHubHeader({
  lead,
  canUpdateLead,
  canConvertToDeal,
  quickStageId,
  stageBusy,
  onStageChange,
  onRecordCall,
  onScheduleMeasurement,
  onConvertClick,
  converting,
  canViewEstimates,
}: LeadHubHeaderProps) {
  const phone =
    lead.contact?.phone?.trim() || lead.phone?.trim() || null;
  const tel = telHref(phone);
  const smartHint = deriveLeadSalesHint(lead);
  const dominant = getLeadDominantNextStep(mapLeadDetailRowToCoreInput(lead));
  const coreIn = mapLeadDetailRowToCoreInput(lead);
  const risks = computeLeadRisks(coreIn);
  const topRisk = risks.items[0];

  const activeEst = lead.activeEstimateId
    ? lead.estimates.find((e) => e.id === lead.activeEstimateId)
    : lead.estimates[0];
  const amountStr = activeEst ? formatUah(activeEst.totalPrice) : "—";

  const btn =
    "inline-flex items-center justify-center rounded-lg border border-slate-200 bg-[var(--enver-card)] px-2.5 py-1.5 text-[11px] font-medium text-slate-800 shadow-sm transition hover:bg-[var(--enver-hover)] disabled:opacity-50";
  const btnPrimary =
    "inline-flex items-center justify-center rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50";
  const btnGreen =
    "inline-flex items-center justify-center rounded-lg bg-emerald-700 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-50";

  return (
    <div className="sticky top-0 z-30 -mx-3 border-b border-slate-200/90 bg-slate-50/95 px-3 py-2.5 backdrop-blur-md md:-mx-6 md:px-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="min-w-0 text-lg font-semibold tracking-tight text-[var(--enver-text)] md:text-xl">
            {lead.title}
          </h1>
          {topRisk ? (
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                topRisk.severity === "high" && "bg-rose-100 text-rose-900",
                topRisk.severity === "medium" && "bg-amber-100 text-amber-900",
                topRisk.severity === "low" && "bg-slate-100 text-slate-700",
              )}
              title={topRisk.messageUa}
            >
              Ризик
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600">
          <span className="rounded-md bg-[var(--enver-card)] px-1.5 py-0.5 font-semibold text-[var(--enver-text)] ring-1 ring-slate-200">
            {lead.stage.name}
          </span>
          <span className="text-slate-300">·</span>
          {phone ? (
            <span className="font-semibold text-[var(--enver-text)]">{phone}</span>
          ) : (
            <span className="text-amber-700">Немає телефону</span>
          )}
          <span className="text-slate-300">·</span>
          <span>{lead.source}</span>
          <span className="text-slate-300">·</span>
          <span className="font-medium text-slate-800">
            {lead.owner.name ?? lead.owner.email}
          </span>
          <span className="text-slate-300">·</span>
          {canUpdateLead ? (
            <select
              value={quickStageId}
              disabled={stageBusy}
              onChange={(e) => onStageChange(e.target.value)}
              className="max-w-[min(100%,14rem)] rounded-md border border-slate-200 bg-[var(--enver-card)] px-1.5 py-0.5 text-[11px] font-medium outline-none focus:border-slate-400 disabled:opacity-50"
            >
              {lead.pipelineStages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.isFinal ? " (фінал)" : ""}
                </option>
              ))}
            </select>
          ) : (
            <span className="rounded-md border border-slate-200 bg-[var(--enver-card)] px-1.5 py-0.5 text-[11px] font-medium">
              {lead.stage.name}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200/80 bg-[var(--enver-card)] px-2.5 py-2 text-[10px]">
            <p className="text-slate-500">Сума (активна смета)</p>
            <p className="mt-0.5 font-semibold text-[var(--enver-text)]">{amountStr}</p>
          </div>
          <div className="rounded-lg border border-slate-200/80 bg-[var(--enver-card)] px-2.5 py-2 text-[10px]">
            <p className="text-slate-500">Наступний контакт</p>
            <p className="mt-0.5 font-semibold text-[var(--enver-text)]">
              {lead.nextContactAt
                ? format(new Date(lead.nextContactAt), "d MMM", { locale: uk })
                : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200/80 bg-[var(--enver-card)] px-2.5 py-2 text-[10px]">
            <p className="text-slate-500">Остання активність</p>
            <p className="mt-0.5 font-semibold text-[var(--enver-text)]">
              {lead.lastActivityAt
                ? format(new Date(lead.lastActivityAt), "d MMM HH:mm", {
                    locale: uk,
                  })
                : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200/80 bg-[var(--enver-card)] px-2.5 py-2 text-[10px]">
            <p className="text-slate-500">Пріоритетний крок</p>
            <p className="mt-0.5 line-clamp-2 font-semibold text-violet-900">
              {dominant.labelUa}
            </p>
          </div>
        </div>

        <div
          className="flex gap-2 rounded-xl border border-violet-200/60 bg-[var(--enver-card)]/90 px-2.5 py-2 text-[11px] leading-snug text-slate-800"
          role="status"
        >
          <Sparkles
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600"
            aria-hidden
          />
          <p className="min-w-0 flex-1">
            <span className="font-semibold text-violet-900">Підказка: </span>
            {smartHint}
          </p>
        </div>

        <p className="text-[10px] text-slate-500">
          Деталі кроку та дати — у блоці{" "}
          <a
            href="#lead-next-action"
            className="font-medium text-sky-800 underline decoration-sky-300 underline-offset-2 hover:text-sky-950"
          >
            «Наступна дія»
          </a>
          .
        </p>

        <div className="flex flex-wrap gap-1.5">
          {tel ? (
            <a
              href={tel}
              onClick={() => onRecordCall()}
              className={btnPrimary}
            >
              Дзвінок
            </a>
          ) : (
            <span className={cn(btn, "cursor-not-allowed text-slate-400")}>
              Дзвінок
            </span>
          )}
          <Link href={`/leads/${lead.id}/messages`} className={btn}>
            Повідомлення
          </Link>
          <Link
            href={`/leads/${lead.id}/ai`}
            className={cn(btn, "gap-1")}
            title="AI-підказки та чернетки по ліду"
          >
            <Sparkles className="h-3 w-3 shrink-0 text-violet-600" aria-hidden />
            AI
          </Link>
          {canViewEstimates ? (
            <Link
              href={`/leads/${lead.id}/pricing`}
              className={cn(btn, "gap-1")}
              title="Розрахунок вартості по ліду"
            >
              <Calculator className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
              Розрахунок
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => onScheduleMeasurement()}
            className={btn}
          >
            Замір
          </button>
          {lead.linkedDeal ? (
            <Link href={`/deals/${lead.linkedDeal.id}/workspace`} className={btnGreen}>
              Відкрити замовлення
            </Link>
          ) : canConvertToDeal ? (
            <button
              type="button"
              disabled={converting}
              onClick={() => onConvertClick()}
              className={btnGreen}
              title="Конвертувати лід у замовлення (одна дія)"
            >
              {converting ? "…" : "Замовлення"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
