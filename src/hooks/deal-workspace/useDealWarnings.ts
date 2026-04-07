import { useMemo } from "react";
import type { DealWorkspacePayload } from "../../features/deal-workspace/types";
import { deriveDealWarnings } from "../../features/deal-workspace/deal-workspace-warnings";

export function useDealWarnings(data: DealWorkspacePayload) {
  return useMemo(() => deriveDealWarnings(data), [data]);
}
