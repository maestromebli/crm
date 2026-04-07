"use client";

import { Check, Circle } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { LeadDetailRow } from "../../../../features/leads/queries";
import {
  buildLeadFunnelPanelRows,
  funnelCurrentBlockerHint,
  mapLeadDetailRowToCoreInput,
} from "../../../../lib/crm-core";
import { cn } from "../../../../lib/utils";

type Props = {
  lead: LeadDetailRow;
  className?: string;
};

export function LeadFlowStagePanel({ lead, className }: Props) {
  const reduceMotion = useReducedMotion();
  const core = mapLeadDetailRowToCoreInput(lead);
  const rows = buildLeadFunnelPanelRows(core);
  const blocker = funnelCurrentBlockerHint(core);

  return (
    <section
      className={cn(
        "border-b border-[var(--enver-border)] px-3 py-3",
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
        {rows.map((row, i) => (
          <motion.li
            key={row.key}
            initial={reduceMotion ? false : { opacity: 0.85, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.02, duration: 0.2 }}
            className={cn(
              "flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-[11px] leading-tight",
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
            <span
              className={cn(
                "min-w-0 flex-1",
                row.state === "current" && "font-semibold text-[var(--enver-text)]",
              )}
            >
              {row.labelUa}
            </span>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
