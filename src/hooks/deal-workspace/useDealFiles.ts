import { useMemo } from "react";
import type { DealWorkspacePayload } from "../../features/deal-workspace/types";

export function useDealFiles(data: DealWorkspacePayload) {
  return useMemo(
    () => ({
      attachmentsCount: data.attachmentsCount,
      byCategory: data.attachmentsByCategory,
    }),
    [data.attachmentsByCategory, data.attachmentsCount],
  );
}
