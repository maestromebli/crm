"use client";

import type { LeadDetailRow } from "../../features/leads/queries";
import { LeadAiManagerPanel } from "./LeadAiManagerPanel";

type Props = {
  lead: LeadDetailRow;
  canUpdateLead: boolean;
};

/** Вкладка «AI‑нотатки»: повний аналіз і керування стадією через ШІ або вручну. */
export function LeadAiTabClient({ lead, canUpdateLead }: Props) {
  return (
    <LeadAiManagerPanel lead={lead} canUpdateLead={canUpdateLead} />
  );
}
