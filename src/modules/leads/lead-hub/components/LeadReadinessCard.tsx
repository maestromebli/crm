"use client";

import type { LeadDetailRow } from "../../../../features/leads/queries";
import { computeLeadHubReadinessFromDetail } from "../../../../lib/leads/lead-hub-readiness";
import {
  leadResponseStatus,
  leadWarningLevel,
} from "../../../../lib/leads/lead-row-meta";
import { cn } from "../../../../lib/utils";

type Props = {
  lead: LeadDetailRow;
};

export function LeadReadinessCard({ lead }: Props) {
  const phone =
    lead.contact?.phone?.trim() || lead.phone?.trim() || null;
  const meta = {
    id: lead.id,
    phone,
    nextStep: lead.nextStep,
    nextContactAt: lead.nextContactAt,
    lastActivityAt: lead.lastActivityAt,
    createdAt: lead.createdAt,
    stage: lead.stage,
  };
  const response = leadResponseStatus(meta);
  const warn = leadWarningLevel(meta, false);
  const readiness = computeLeadHubReadinessFromDetail(lead);
  const checklist = readiness.items;
  const missing = checklist.filter((x) => !x.ok).map((x) => x.label);

  return (
    <section className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
      <h3 className="text-xs font-semibold text-[var(--enver-text)]">Готовність</h3>
      <p
        className={cn(
          "mt-1 text-sm font-medium",
          readiness.level === "ready" && "text-emerald-800",
          readiness.level === "soft" && "text-amber-800",
          readiness.level === "attention" && "text-rose-800",
        )}
      >
        {readiness.headline}
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500">
        Статус відповіді: {response.label}
      </p>

      {warn.level ? (
        <ul className="mt-2 space-y-0.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-950">
          {warn.hints.map((h) => (
            <li key={h}>· {h}</li>
          ))}
        </ul>
      ) : null}

      <ul className="mt-3 space-y-1">
        {checklist.map((row) => (
          <li
            key={row.key}
            className="flex items-center justify-between text-xs text-slate-800"
          >
            <span>{row.label}</span>
            <span className="text-base" aria-hidden>
              {row.ok ? "✔" : "⚠"}
            </span>
          </li>
        ))}
      </ul>

      {missing.length ? (
        <p className="mt-2 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] text-slate-700">
          <span className="font-medium">Не вистачає: </span>
          {missing.join(", ")}
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-emerald-800">Чекліст закритий по базі.</p>
      )}
    </section>
  );
}
