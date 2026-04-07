import { useMemo } from "react";
import type { DealWorkspacePayload } from "../../features/deal-workspace/types";
import { derivePaymentStripSummary } from "../../features/deal-workspace/deal-workspace-warnings";

export function useDealPayments(data: DealWorkspacePayload) {
  return useMemo(() => {
    const strip = derivePaymentStripSummary(data.meta);
    const milestones = data.meta.payment?.milestones ?? [];
    return {
      strip,
      milestones,
      dealValue: data.deal.value,
      currency: data.deal.currency,
    };
  }, [data]);
}
