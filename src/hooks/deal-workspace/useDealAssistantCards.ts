import { useMemo } from "react";
import type { DealWorkspacePayload } from "../../features/deal-workspace/types";
import { deriveAssistantCards } from "../../features/deal-workspace/deal-workspace-warnings";

export function useDealAssistantCards(data: DealWorkspacePayload) {
  return useMemo(() => deriveAssistantCards(data), [data]);
}
