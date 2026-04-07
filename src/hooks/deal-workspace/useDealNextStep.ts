import { useMemo } from "react";
import type { DealWorkspacePayload } from "../../features/deal-workspace/types";
import {
  deriveNextActionLabel,
  deriveNextStepSeverity,
} from "../../features/deal-workspace/insights";

export function useDealNextStep(data: DealWorkspacePayload) {
  return useMemo(() => {
    const label = deriveNextActionLabel(data);
    const severity = deriveNextStepSeverity(data.meta);
    const at = data.meta.nextActionAt ?? null;
    return {
      label,
      severity,
      nextActionAt: at,
      nextStepKind: data.meta.nextStepKind ?? null,
      rawLabel: data.meta.nextStepLabel?.trim() ?? null,
    };
  }, [data]);
}
