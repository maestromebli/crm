import type { DealHubHealthStatus } from "./deal.status";

export type DealHealthSignal =
  | "OVERDUE_PAYMENT"
  | "LOW_MARGIN"
  | "MISSING_MEASUREMENT"
  | "MISSING_TECHNICAL_FILES"
  | "PRODUCTION_BLOCKER"
  | "PROCUREMENT_SHORTAGE"
  | "MISSED_MILESTONE"
  | "INSTALLATION_UNSCHEDULED"
  | "NEXT_OWNER_UNCLEAR"
  | "STALE_ACTIVITY";

export type DealHealthEvaluation = {
  status: DealHubHealthStatus;
  score: number;
  reasons: string[];
  signals: DealHealthSignal[];
  suggestedActions: string[];
};
