import { useMemo } from "react";
import type { DealWorkspacePayload } from "../../features/deal-workspace/types";
import {
  deriveAssistantCards,
  deriveDealWarnings,
  deriveReadinessStripState,
} from "../../features/deal-workspace/deal-workspace-warnings";
import { derivePaymentStripSummaryForPayload } from "../../features/deal-workspace/payment-aggregate";
import {
  deriveAiSummary,
  deriveNextActionLabel,
  deriveNextBestAction,
} from "../../features/deal-workspace/insights";

/** Зведений хук для клієнтських панелей робочого місця угоди. */
export function useDealWorkspace(data: DealWorkspacePayload) {
  return useMemo(
    () => ({
      nextActionLabel: deriveNextActionLabel(data),
      nextBestAction: deriveNextBestAction(data),
      aiSummary: deriveAiSummary(data),
      warnings: deriveDealWarnings(data),
      assistantCards: deriveAssistantCards(data),
      readiness: deriveReadinessStripState(data),
      paymentStrip: derivePaymentStripSummaryForPayload(data),
      stats: data.operationalStats,
    }),
    [data],
  );
}
