import { useMemo } from "react";
import type { DealWorkspacePayload } from "../../features/deal-workspace/types";

export function useDealEstimates(data: DealWorkspacePayload) {
  return useMemo(
    () => ({
      count: data.operationalStats.estimatesCount,
      latest: data.operationalStats.latestEstimate,
    }),
    [data.operationalStats.estimatesCount, data.operationalStats.latestEstimate],
  );
}
