"use client";

import { format } from "date-fns";
import { uk } from "date-fns/locale";
import type { LeadDetailRow } from "../../../../features/leads/queries";

type Props = {
  lead: LeadDetailRow;
};

export function LeadHubSummaryStrip({ lead }: Props) {
  const name =
    lead.contact?.fullName?.trim() || lead.contactName?.trim() || lead.title;
  const last =
    lead.lastActivityAt != null
      ? format(new Date(lead.lastActivityAt), "d MMM yyyy, HH:mm", {
          locale: uk,
        })
      : "—";

  return (
    <div className="border-b border-[var(--enver-border)]/80 bg-gradient-to-br from-[var(--enver-card)] to-[var(--enver-surface)] px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
        Поточний лід
      </p>
      <p className="mt-1 line-clamp-2 text-[13px] font-semibold leading-snug text-[var(--enver-text)]">
        {name}
      </p>
      <dl className="mt-2 space-y-1 text-[11px] text-[var(--enver-text-muted)]">
        <div className="flex justify-between gap-2">
          <dt>Джерело</dt>
          <dd className="max-w-[60%] truncate text-right font-medium text-[var(--enver-text)]">
            {lead.source || "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Менеджер</dt>
          <dd className="truncate text-right font-medium text-[var(--enver-text)]">
            {lead.owner.name ?? lead.owner.email}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Останній дотик</dt>
          <dd className="shrink-0 tabular-nums">{last}</dd>
        </div>
      </dl>
    </div>
  );
}
