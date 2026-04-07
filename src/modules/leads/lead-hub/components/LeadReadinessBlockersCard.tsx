"use client";

import Link from "next/link";
import type { LeadDetailRow } from "../../../../features/leads/queries";
import {
  evaluateLeadChecksForStage,
  getStageConfig,
  hubAnchorHref,
  LEAD_CHECK_HUB_ANCHOR,
  mapLeadDetailRowToCoreInput,
  type LeadCheckResult,
} from "../../../../lib/crm-core";

type Props = {
  lead: LeadDetailRow;
};

function Row({
  r,
  leadId,
}: {
  r: LeadCheckResult;
  leadId: string;
}) {
  const anchor = LEAD_CHECK_HUB_ANCHOR[r.id];
  const fixHref = anchor ? `/leads/${leadId}${hubAnchorHref(anchor)}` : null;

  return (
    <li className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2 text-[11px]">
      <div className="min-w-0">
        <p className="font-medium text-[var(--enver-text)]">{r.labelUa}</p>
        {r.hintUa ? (
          <p className="mt-0.5 text-[10px] text-slate-600">{r.hintUa}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={
            r.pass
              ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-900"
              : "rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-900"
          }
        >
          {r.pass ? "Ок" : "Бракує"}
        </span>
        {!r.pass && fixHref ? (
          <Link
            href={fixHref}
            className="text-[10px] font-semibold text-sky-800 underline"
          >
            Виправити
          </Link>
        ) : null}
      </div>
    </li>
  );
}

/** Обов’язкові перевірки для поточної стадії (CRM Core) + перехід до секції. */
export function LeadReadinessBlockersCard({ lead }: Props) {
  const input = mapLeadDetailRowToCoreInput(lead);
  const cfg = getStageConfig(input.stageKey);
  const { required, soft } = evaluateLeadChecksForStage(
    input,
    cfg.requiredChecks,
    cfg.softChecks,
  );
  const all = [...required, ...soft];
  const missing = all.filter((x) => !x.pass);

  return (
    <section className="rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-card)] p-4 shadow-[var(--enver-shadow)]">
      <h3 className="text-[14px] font-medium text-[var(--enver-text)]">
        Чеклист: {cfg.labelUa}
      </h3>
      <p className="mt-0.5 text-[12px] text-[var(--enver-muted)]">
        {missing.length > 0
          ? `Закрийте ${missing.length} обов’язкових або рекомендованих пунктів перед переходом далі.`
          : "Базові вимоги стадії закриті."}
      </p>
      <ul className="mt-3 space-y-2">
        {all.map((r) => (
          <Row key={r.id} r={r} leadId={lead.id} />
        ))}
      </ul>
    </section>
  );
}
