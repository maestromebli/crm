import type { DealAiSummary, DealAiInput } from "./deal-ai.types";

export function mapDealHubOverviewToAiSummary(input: DealAiInput): DealAiSummary {
  const overview = input.overview;
  const blockers = overview.risks.map((risk) => risk.title).slice(0, 5);
  return {
    headline: `${overview.deal.stageLabel} · ${overview.стан.status}`,
    blockers,
    nextActions: overview.nextActions.map((item) => item.title).slice(0, 5),
    delayRisk:
      overview.стан.status === "GOOD"
        ? "low"
        : overview.стан.status === "WARNING"
          ? "medium"
          : "high",
  };
}
