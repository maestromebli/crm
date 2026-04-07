import { useMemo } from "react";
import type { DealWorkspacePayload } from "../../features/deal-workspace/types";

export function useDealTasks(data: DealWorkspacePayload) {
  return useMemo(
    () => ({
      open: data.operationalStats.openTasksCount,
      overdue: data.operationalStats.overdueOpenTasksCount,
      done: data.operationalStats.completedTasksCount,
    }),
    [data.operationalStats],
  );
}
