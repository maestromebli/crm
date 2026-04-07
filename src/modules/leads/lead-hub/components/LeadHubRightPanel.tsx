"use client";

import type { LeadDetailRow } from "../../../../features/leads/queries";
import { LeadAiOperationsPanel } from "../../../../features/ai";
import { LeadReadinessBlockersCard } from "./LeadReadinessBlockersCard";
import { LeadHubSmartInsightsCard } from "./LeadHubSmartInsightsCard";
import { LeadHubNextStepBanner } from "./LeadHubNextStepBanner";

type Props = {
  lead: LeadDetailRow;
};

export function LeadHubRightPanel({ lead }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <LeadHubSmartInsightsCard lead={lead} />
      <LeadAiOperationsPanel leadId={lead.id} />
      <LeadReadinessBlockersCard lead={lead} />
      <div className="mt-auto pt-2">
        <LeadHubNextStepBanner lead={lead} placement="rail" />
      </div>
    </div>
  );
}
