import type { DealAiSummary, DealAiInput } from "./deal-ai.types";

export function mapDealHubOverviewToAiSummary(input: DealAiInput): DealAiSummary {
  const overview = input.overview;
  const blockers = overview.risks.map((risk) => risk.title).slice(0, 5);
  return {
    headline: `${overview.deal.stageLabel} · ${overview.health.status}`,
    blockers,
    nextActions: overview.nextActions.map((item) => item.title).slice(0, 5),
    delayRisk:
      overview.health.status === "GOOD"
        ? "low"
        : overview.health.status === "WARNING"
          ? "medium"
          : "high",
  };
}
