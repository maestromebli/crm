import type { DealHubRole } from "../domain/deal.types";
import { getDealHubOverview } from "./deal-hub.service";
import { getDealHubAggregate } from "./deal-hub.repository";
import { evaluateDealHealth } from "./deal-health.service";
import { buildDealNextActions } from "./deal-next-actions.service";
import { buildDealTimeline } from "./deal-timeline.service";

export async function queryDealHubOverview(dealId: string, role: DealHubRole) {
  return getDealHubOverview(dealId, role);
}

export async function queryDealHubHealth(dealId: string) {
  const aggregate = await getDealHubAggregate(dealId);
  if (!aggregate) return null;
  return evaluateDealHealth(aggregate);
}

export async function queryDealHubNextActions(dealId: string, role: DealHubRole) {
  const aggregate = await getDealHubAggregate(dealId);
  if (!aggregate) return [];
  return buildDealNextActions(aggregate, { role });
}

export async function queryDealHubTimeline(dealId: string) {
  const aggregate = await getDealHubAggregate(dealId);
  if (!aggregate) return [];
  return buildDealTimeline(aggregate);
}
