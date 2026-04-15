"use client";

import type { ReactNode } from "react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { motion, useReducedMotion } from "framer-motion";
import type { LeadDetailRow } from "../../../../features/leads/queries";

function formatUah(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return (
    new Intl.NumberFormat("uk-UA", {
      maximumFractionDigits: n % 1 === 0 ? 0 : 2,
    }).format(n) + " грн"
  );
}

function isApprovedProposalStatus(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase();
  return s.includes("approv") || s.includes("погод");
}

export type LeadHubClientHeaderProps = {
  lead: LeadDetailRow;
  quickStageId: string;
  stageBusy: boolean;
  autoStageBusy?: boolean;
  canUpdateLead: boolean;
  canAutoAdvanceStage?: boolean;
  onStageChange: (stageId: string) => void;
  onAutoAdvanceStage?: () => void;
  /** Головний CTA (Наступний крок) — рівень 1. */
  primaryCta?: ReactNode;
  /** Другорядні швидкі дії — рівень 2. */
  quickActions?: ReactNode;
};

export function LeadHubClientHeader({
  lead,
  quickStageId,
  stageBusy,
  autoStageBusy = false,
  canUpdateLead,
  canAutoAdvanceStage = false,
  onStageChange,
  onAutoAdvanceStage,
  primaryCta,
  quickActions,
}: LeadHubClientHeaderProps) {
  const reduceMotion = useReducedMotion();
  const displayName =
    lead.contact?.fullName?.trim() || lead.contactName?.trim() || lead.title;
  const phone =
    lead.contact?.phone?.trim() || lead.phone?.trim() || null;
  const estTotal =
    lead.activeEstimateId != null
      ? lead.estimates.find((e) => e.id === lead.activeEstimateId)?.totalPrice ??
        null
      : lead.estimates[0]?.totalPrice ?? null;
  const approvedProposal = lead.proposals.find(
    (p) => p.approvedAt != null || isApprovedProposalStatus(p.status),
  );
  const approvedProposalTotal =
    approvedProposal?.estimateId != null
      ? lead.estimates.find((e) => e.id === approvedProposal.estimateId)?.totalPrice ??
        null
      : null;
  const budget =
    approvedProposalTotal != null
      ? formatUah(approvedProposalTotal)
      : estTotal != null
        ? formatUah(estTotal)
        : lead.qualification.budgetRange?.trim() || "—";
  const deadline =
    lead.qualification.timeline?.trim() ||
    (lead.nextContactAt
      ? format(new Date(lead.nextContactAt), "d MMM yyyy", { locale: uk })
      : "—");

  return (
    <motion.header
      className="enver-card-appear leadhub-card relative overflow-hidden p-4 md:p-5"
      initial={reduceMotion ? false : { opacity: 0.92, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-r from-indigo-100/65 via-sky-100/45 to-transparent"
      />
      <div className="flex flex-wrap items-start justify-between gap-3 md:flex-nowrap">
        <div className="min-w-[220px] flex-1">
          <div className="mb-1 inline-flex items-center whitespace-nowrap rounded-full border border-indigo-200/70 bg-indigo-50/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-indigo-700 [overflow-wrap:normal]">
            Lead Workspace
          </div>
          <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-[var(--enver-text)] [overflow-wrap:normal] md:text-[24px]">
            {displayName}
          </h1>
          <p className="mt-1 text-[12px] text-[var(--enver-muted)] [overflow-wrap:normal]">
            {lead.owner.name ?? lead.owner.email}
          </p>
        </div>
        {canUpdateLead ? (
          <div className="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto md:justify-start">
            <select
              value={quickStageId}
              disabled={stageBusy || autoStageBusy}
              onChange={(e) => onStageChange(e.target.value)}
              className="max-w-[14rem] cursor-pointer rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-card)]/95 px-2.5 py-1.5 text-[12px] font-medium text-[var(--enver-text)] outline-none transition duration-200 focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {lead.pipelineStages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.isFinal ? " · фінал" : ""}
                </option>
              ))}
            </select>
            {canAutoAdvanceStage && onAutoAdvanceStage ? (
              <button
                type="button"
                disabled={stageBusy || autoStageBusy}
                onClick={onAutoAdvanceStage}
                className="rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-bg)]/85 px-2.5 py-1.5 text-[12px] font-medium text-[var(--enver-text)] transition hover:-translate-y-0.5 hover:bg-[var(--enver-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {autoStageBusy ? "Авто…" : "Автоетап"}
              </button>
            ) : null}
          </div>
        ) : (
          <span className="rounded-[12px] border border-[var(--enver-border)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--enver-text)]">
            {lead.stage.name}
          </span>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <div className="min-w-0 rounded-[12px] border border-[var(--enver-border)]/80 bg-[var(--enver-bg)]/78 px-3 py-2.5">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--enver-muted)]">Стадія</dt>
          <dd className="mt-1 min-w-0 break-words text-[13px] font-semibold text-[var(--enver-text)]">
            {lead.stage.name}
          </dd>
        </div>
        <div className="min-w-0 rounded-[12px] border border-[var(--enver-border)]/80 bg-[var(--enver-bg)]/78 px-3 py-2.5">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--enver-muted)]">Телефон</dt>
          <dd className="mt-1 min-w-0 break-all text-[13px] font-medium text-[var(--enver-text)]">
            {phone ?? "—"}
          </dd>
        </div>
        <div className="min-w-0 rounded-[12px] border border-[var(--enver-border)]/80 bg-[var(--enver-bg)]/78 px-3 py-2.5">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--enver-muted)]">Бюджет</dt>
          <dd className="mt-1 min-w-0 break-words text-[13px] font-semibold text-[var(--enver-text)]">
            {budget}
          </dd>
        </div>
        <div className="min-w-0 rounded-[12px] border border-[var(--enver-border)]/80 bg-[var(--enver-bg)]/78 px-3 py-2.5">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--enver-muted)]">Дедлайн</dt>
          <dd className="mt-1 min-w-0 break-words text-[13px] font-medium text-[var(--enver-text)]">
            {deadline}
          </dd>
        </div>
      </dl>

      {primaryCta || quickActions ? (
        <div className="mt-5 space-y-3 border-t border-[var(--enver-border)] pt-4">
          {primaryCta ? <div className="min-w-0">{primaryCta}</div> : null}
          {quickActions ? (
            <div className="flex justify-end">{quickActions}</div>
          ) : null}
        </div>
      ) : null}
    </motion.header>
  );
}
