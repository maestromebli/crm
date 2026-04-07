"use client";

import Link from "next/link";
import type { LeadDetailRow } from "../../../../features/leads/queries";
import { LeadHubLeadsRail } from "./LeadHubLeadsRail";
import { LeadFlowStagePanel } from "./LeadFlowStagePanel";
import { LeadHubSummaryStrip } from "./LeadHubSummaryStrip";
import { LeadWorkspaceChecklist } from "./LeadWorkspaceChecklist";

type Props = {
  lead: LeadDetailRow;
};

/**
 * Ліва колонка Hub: контроль, етапи, чекліст, швидкий доступ до списку лідів.
 */
export function LeadHubFlowColumn({ lead }: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <LeadHubSummaryStrip lead={lead} />
      <LeadFlowStagePanel lead={lead} />
      <LeadWorkspaceChecklist lead={lead} className="border-b-0" />
      <div className="shrink-0 border-t border-[var(--enver-border)] px-3 py-2">
        <Link
          href="/leads"
          className="text-[11px] font-medium text-[var(--enver-accent)] hover:underline"
        >
          ← Усі ліди
        </Link>
      </div>
      <div className="min-h-[200px] shrink-0 border-t border-[var(--enver-border)]">
        <LeadHubLeadsRail currentLeadId={lead.id} />
      </div>
    </div>
  );
}
