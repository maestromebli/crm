"use client";

import { LeadActivityTabClient } from "../LeadActivityTabClient";

type LeadActivityProps = {
  leadId: string;
};

export function LeadActivity({ leadId }: LeadActivityProps) {
  return <LeadActivityTabClient leadId={leadId} />;
}
