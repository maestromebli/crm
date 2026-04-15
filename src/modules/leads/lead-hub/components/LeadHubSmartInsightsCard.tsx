"use client";

import { Sparkles, AlertTriangle } from "lucide-react";
import type { LeadDetailRow } from "../../../../features/leads/queries";
import {
  buildLeadAiHints,
  computeLeadRisks,
  mapLeadDetailRowToCoreInput,
} from "../../../../lib/crm-core";
import { cn } from "../../../../lib/utils";

type Props = {
  lead: LeadDetailRow;
};

/** Ризики + структуровані AI-підказки (локальні правила CRM Core). */
export function LeadHubSmartInsightsCard({ lead }: Props) {
  const input = mapLeadDetailRowToCoreInput(lead);
  const risks = computeLeadRisks(input);
  const hints = buildLeadAiHints(input).slice(0, 5);

  if (risks.items.length === 0 && hints.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[14px] border border-[var(--enver-border)]/80 bg-gradient-to-br from-[var(--enver-card)] to-[var(--enver-surface)] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
      <div className="flex items-center gap-2 text-[var(--enver-text)]">
        <Sparkles className="h-4 w-4 shrink-0 text-[var(--enver-accent)]" aria-hidden />
        <h3 className="text-[12px] font-medium uppercase tracking-wide text-[var(--enver-muted)]">
          Смарт-огляд
        </h3>
      </div>

      {risks.items.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {risks.items.slice(0, 4).map((x) => (
            <li
              key={x.flag}
              className={cn(
                "flex gap-2 rounded-lg border px-2.5 py-2 text-[11px] leading-snug shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
                x.severity === "high"
                  ? "border-[var(--enver-danger)]/35 bg-[var(--enver-danger-soft)] text-[var(--enver-text)]"
                  : x.severity === "medium"
                    ? "border-[var(--enver-warning)]/35 bg-[var(--enver-warning-soft)] text-[var(--enver-text)]"
                    : "border-[var(--enver-border)] bg-[var(--enver-surface-elevated)] text-[var(--enver-text-muted)]",
              )}
            >
              <AlertTriangle
                className={cn(
                  "mt-0.5 h-3.5 w-3.5 shrink-0",
                  x.severity === "high"
                    ? "text-[var(--enver-danger)]"
                    : x.severity === "medium"
                      ? "text-[var(--enver-warning)]"
                      : "text-[var(--enver-muted)]",
                )}
              />
              <span>{x.messageUa}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {hints.length > 0 ? (
        <ul
          className={cn(
            "space-y-1.5 text-[12px] leading-snug text-[var(--enver-text-muted)]",
            risks.items.length > 0 ? "mt-3 border-t border-[var(--enver-border)] pt-3" : "mt-2",
          )}
        >
          {hints.map((h) => (
            <li key={h.id} className="flex gap-2">
              <span className="text-[var(--enver-accent)]">·</span>
              <span>{h.textUa}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
