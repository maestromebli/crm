"use client";

import Link from "next/link";
import type { LeadDetailRow } from "../../../../features/leads/queries";
import { LeadFlowStagePanel } from "./LeadFlowStagePanel";
import { LeadHubLeadsRail } from "./LeadHubLeadsRail";

type Props = {
  lead: LeadDetailRow;
};

/**
 * Ліва колонка Hub: контроль, етапи, чекліст, швидкий доступ до списку лідів.
 */
export function LeadHubFlowColumn({ lead }: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-x-hidden overflow-y-auto">
      <LeadFlowStagePanel lead={lead} />
      <div className="shrink-0 border-t border-[var(--enver-border)]/90 bg-[var(--enver-card)]/62 px-3 py-2.5">
        <Link
          href="/leads"
          className="leadhub-btn inline-flex rounded-[10px] px-2.5 py-1.5 text-[11px] font-medium text-[var(--enver-accent)]"
        >
          ← Усі ліди
        </Link>
      </div>
      <div className="min-h-[200px] shrink-0 border-t border-[var(--enver-border)]/90 bg-[var(--enver-card)]/45">
        <LeadHubLeadsRail currentLeadId={lead.id} />
      </div>
    </div>
  );
}
