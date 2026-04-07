"use client";

import Link from "next/link";
import type { LeadDetailRow } from "../../../../features/leads/queries";
import { computeLeadHubReadinessFromDetail } from "../../../../lib/leads/lead-hub-readiness";
import {
  computeLeadReadinessRows,
  deriveLeadReadinessRecommendation,
  type ReadinessRowState,
} from "../../../../lib/leads/lead-readiness-rows";
import {
  leadResponseStatus,
  leadWarningLevel,
} from "../../../../lib/leads/lead-row-meta";
import { cn } from "../../../../lib/utils";

type Props = {
  lead: LeadDetailRow;
};

const tempUa: Record<string, string> = {
  cold: "Холодний",
  warm: "Теплий",
  hot: "Гарячий",
};

function stateBadge(state: ReadinessRowState) {
  if (state === "ready")
    return "bg-emerald-50 text-emerald-900 ring-emerald-200";
  if (state === "partial")
    return "bg-amber-50 text-amber-950 ring-amber-200";
  return "bg-rose-50 text-rose-900 ring-rose-200";
}

function stateLabel(state: ReadinessRowState) {
  if (state === "ready") return "Готово";
  if (state === "partial") return "Частково";
  return "Ні";
}

/** Готовність (чеклист) + коротка кваліфікація — правий стовпчик. */
export function LeadReadinessQualificationCard({ lead }: Props) {
  const meta = {
    id: lead.id,
    phone: lead.contact?.phone?.trim() || lead.phone?.trim() || null,
    nextStep: lead.nextStep,
    nextContactAt: lead.nextContactAt,
    lastActivityAt: lead.lastActivityAt,
    createdAt: lead.createdAt,
    stage: lead.stage,
  };
  const response = leadResponseStatus(meta);
  const warn = leadWarningLevel(meta, false);

  const readiness = computeLeadHubReadinessFromDetail(lead);

  const rows = computeLeadReadinessRows(lead);
  const recommendation = deriveLeadReadinessRecommendation(rows);

  return (
    <section
      id="lead-readiness"
      className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-3 shadow-sm ring-1 ring-slate-900/5"
    >
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Готовність до продажу
      </h3>
      <p
        className={cn(
          "mt-1 text-sm font-semibold leading-snug",
          readiness.level === "ready" && "text-emerald-800",
          readiness.level === "soft" && "text-amber-800",
          readiness.level === "attention" && "text-rose-800",
        )}
      >
        {readiness.headline}
      </p>
      <p className="mt-0.5 text-[10px] text-slate-500">
        Відповідь клієнта: {response.label}
      </p>

      {warn.level ? (
        <ul className="mt-2 space-y-0.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-950">
          {warn.hints.slice(0, 2).map((h) => (
            <li key={h}>· {h}</li>
          ))}
        </ul>
      ) : null}

      <ul className="mt-3 space-y-1.5">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-1.5"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-800">
                {row.label}
              </p>
              {row.hint ? (
                <p className="text-[10px] text-slate-500">{row.hint}</p>
              ) : null}
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ring-1",
                stateBadge(row.state),
              )}
            >
              {stateLabel(row.state)}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-2 rounded-lg border border-sky-100 bg-sky-50/80 px-2 py-1.5 text-[10px] leading-snug text-sky-950">
        <span className="font-semibold">Рекомендація: </span>
        {recommendation}
      </p>

      <div className="mt-3 border-t border-slate-100 pt-2">
        <p className="text-[10px] font-semibold uppercase text-slate-400">
          Кваліфікація (коротко)
        </p>
        <dl className="mt-1 space-y-0.5 text-[11px]">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Проєкт</dt>
            <dd className="max-w-[55%] truncate text-right font-medium text-[var(--enver-text)]">
              {lead.qualification.furnitureType?.trim() || "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Обʼєкт</dt>
            <dd className="max-w-[55%] truncate text-right font-medium text-[var(--enver-text)]">
              {lead.qualification.objectType?.trim() || "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Бюджет</dt>
            <dd className="max-w-[55%] truncate text-right font-medium text-[var(--enver-text)]">
              {lead.qualification.budgetRange?.trim() || "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Терміни</dt>
            <dd className="max-w-[55%] truncate text-right font-medium text-[var(--enver-text)]">
              {lead.qualification.timeline?.trim() || "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Темп.</dt>
            <dd className="text-right font-medium text-[var(--enver-text)]">
              {lead.qualification.temperature
                ? tempUa[lead.qualification.temperature] ??
                  lead.qualification.temperature
                : "—"}
            </dd>
          </div>
        </dl>
        <Link
          href={`/leads/${lead.id}#lead-extra`}
          className="mt-2 inline-block text-[10px] font-medium text-slate-700 underline"
        >
          Редагувати кваліфікацію (повна форма)
        </Link>
      </div>
    </section>
  );
}
