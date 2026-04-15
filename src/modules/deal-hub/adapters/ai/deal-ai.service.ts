import type { DealAiBriefingKind } from "./deal-ai.types";
import { buildDealAiPrompt } from "./deal-ai.prompts";
import { mapDealHubOverviewToAiSummary } from "./deal-ai-mappers";
import { queryDealHubOverview } from "../../server/deal-hub.queries";

export async function buildDealAiGuidance(input: {
  dealId: string;
  role: "OWNER" | "SALES_MANAGER" | "PRODUCTION_MANAGER" | "MANAGER";
  kind: DealAiBriefingKind;
}) {
  // Assistant layer stays thin: read domain snapshot, then build prompt/summary.
  const overview = await queryDealHubOverview(input.dealId, input.role);
  if (!overview) return null;
  const prompt = buildDealAiPrompt({ overview, kind: input.kind });
  const summary = mapDealHubOverviewToAiSummary({ overview, kind: input.kind });
  return {
    prompt,
    summary,
  };
}
