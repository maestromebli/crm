import type { DealHubOverview } from "../../domain/deal.types";

export type DealAiBriefingKind = "manager" | "owner" | "production";

export type DealAiSummary = {
  headline: string;
  blockers: string[];
  nextActions: string[];
  delayRisk: "low" | "medium" | "high";
};

export type DealAiInput = {
  overview: DealHubOverview;
  kind: DealAiBriefingKind;
};
