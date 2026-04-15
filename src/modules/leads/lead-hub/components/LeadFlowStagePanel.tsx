"use client";

import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { LeadDetailRow } from "../../../../features/leads/queries";
import {
  funnelCurrentBlockerHint,
  getStageConfig,
  mapLeadDetailRowToCoreInput,
} from "../../../../lib/crm-core";
import { cn } from "../../../../lib/utils";

type Props = {
  lead: LeadDetailRow;
  className?: string;
};

const FLOW_KEYS = [
  "NEW",
  "CONTACT",
  "MEASUREMENT",
  "CALCULATION",
  "QUOTE_DRAFT",
  "QUOTE_SENT",
  "DEAL",
] as const;

function hrefForLeadStage(
  lead: LeadDetailRow,
  stageKey: string,
): string {
  if (stageKey === "CONTACT") return `/leads/${lead.id}/contact`;
  if (stageKey === "CALCULATION") return `/leads/${lead.id}/pricing`;
  if (stageKey === "QUOTE_DRAFT" || stageKey === "QUOTE_SENT") {
    return `/leads/${lead.id}/kp`;
  }
  if (stageKey === "DEAL" && lead.dealId) {
    return `/deals/${lead.dealId}/workspace`;
  }
  return `/leads/${lead.id}`;
}

export function LeadFlowStagePanel({ lead, className }: Props) {
  const reduceMotion = useReducedMotion();
  const core = mapLeadDetailRowToCoreInput(lead);
  const stageSlug = lead.stage.slug.trim().toLowerCase();
  const stageName = lead.stage.name.trim().toLowerCase();
  const approvedByStage =
    stageSlug === "ready_convert" ||
    stageSlug === "approved" ||
    stageSlug === "proposal_approved" ||
    stageSlug === "quote_approved" ||
    stageSlug === "kp_approved" ||
    stageSlug === "agreed" ||
    stageName.includes("погод") ||
    stageName.includes("узгод");
  const activeOrLatestProposal =
    (lead.activeProposalId
      ? lead.proposals.find((p) => p.id === lead.activeProposalId)
      : null) ?? lead.proposals[0] ?? null;
  const approvedByProposal =
    activeOrLatestProposal != null &&
    (() => {
      const st = activeOrLatestProposal.status.toLowerCase();
      return (
        st.includes("approv") ||
        st.includes("погод") ||
        activeOrLatestProposal.approvedAt != null
      );
    })();
  const shouldForceApproved = approvedByStage || approvedByProposal || core.projectAgreed;
  const inferredCurrent = (() => {
    if (shouldForceApproved) return "QUOTE_SENT";
    if (lead.dealId) return "DEAL";
    if (core.stageKey === "PRODUCTION_READY") return "DEAL";
    if (
      core.stageKey === "CLIENT" ||
      core.stageKey === "CONTROL_MEASUREMENT" ||
      core.stageKey === "CONTRACT"
    ) {
      return "QUOTE_SENT";
    }
    if (FLOW_KEYS.includes(core.stageKey as (typeof FLOW_KEYS)[number])) {
      return core.stageKey as (typeof FLOW_KEYS)[number];
    }
    if (lead.proposals.some((p) => ["SENT", "CLIENT_REVIEWING"].includes(p.status))) {
      return "QUOTE_SENT";
    }
    if (lead.proposals.length > 0 || lead.activeProposalId) return "QUOTE_DRAFT";
    if (lead.estimates.length > 0 || lead.activeEstimateId) return "CALCULATION";
    if (lead.contactId || lead.contact?.phone || lead.phone || lead.contactName) {
      return "CONTACT";
    }
    return "NEW";
  })();
  const currentIdx = FLOW_KEYS.indexOf(inferredCurrent);
  const rowsFull = FLOW_KEYS.map((key, i) => ({
    key,
    labelUa: getStageConfig(key).labelUa,
    state:
      i < currentIdx ? ("done" as const) : i === currentIdx ? ("current" as const) : ("upcoming" as const),
  }));
  const rows = rowsFull;
  const visibleRows = rows.filter((row) => row.state !== "upcoming");
  const blocker = funnelCurrentBlockerHint(core);

  return (
    <section
      className={cn(
        "border-b border-[var(--enver-border)]/80 bg-gradient-to-br from-[var(--enver-card)] to-[var(--enver-surface)] px-3 py-3",
        className,
      )}
      aria-label="Етапи воронки"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
        Шлях ліда
      </p>
      {blocker ? (
        <p className="mt-1.5 rounded-[8px] border border-amber-200/80 bg-amber-50/90 px-2 py-1 text-[10px] leading-snug text-amber-950">
          {blocker}
        </p>
      ) : null}
      <ol className="mt-2 max-h-[min(280px,40vh)] space-y-1 overflow-y-auto pr-0.5">
        {visibleRows.map((row, i) => (
          <motion.li
            key={row.key}
            initial={reduceMotion ? false : { opacity: 0.85, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.02, duration: 0.2 }}
            className="text-[11px] leading-tight"
          >
            <Link
              href={hrefForLeadStage(lead, row.key)}
              className={cn(
                "flex items-center gap-2 rounded-[8px] px-2 py-1.5 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-100/70",
                row.state === "current" && "font-semibold text-[var(--enver-text)]",
                row.state === "current" &&
                  "bg-[var(--enver-accent-soft)] ring-1 ring-[#2563EB]/25",
                row.state === "done" && "text-[var(--enver-text-muted)]",
                row.state === "upcoming" && "text-[var(--enver-muted)]",
              )}
            >
              <span className="shrink-0" aria-hidden>
                {row.state === "done" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : row.state === "current" ? (
                  <Circle className="h-3.5 w-3.5 fill-[#2563EB] text-[#2563EB]" />
                ) : (
                  <Circle className="h-3 w-3 text-[var(--enver-border)]" />
                )}
              </span>
              <span className="min-w-0 flex-1">{row.labelUa}</span>
            </Link>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
