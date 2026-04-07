import { useMemo } from "react";
import type { DealWorkspacePayload } from "../../features/deal-workspace/types";
import { deriveReadinessStripState } from "../../features/deal-workspace/deal-workspace-warnings";

export function useDealReadinessStrip(data: DealWorkspacePayload) {
  return useMemo(() => deriveReadinessStripState(data), [data]);
}
