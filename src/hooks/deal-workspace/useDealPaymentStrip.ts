import { useMemo } from "react";
import type { DealWorkspacePayload } from "../../features/deal-workspace/types";
import { derivePaymentStripSummary } from "../../features/deal-workspace/deal-workspace-warnings";

export function useDealPaymentStrip(data: DealWorkspacePayload) {
  return useMemo(
    () => derivePaymentStripSummary(data.meta),
    [data.meta],
  );
}
