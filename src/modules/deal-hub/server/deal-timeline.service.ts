import type { DealTimelineEventItem } from "../domain/deal-timeline.types";
import type { DealHubAggregate } from "./deal-hub.repository";

function mapActivityTypeToTimelineType(type: string): DealTimelineEventItem["type"] {
  const upper = type.toUpperCase();
  if (upper.includes("STAGE")) return "STAGE_CHANGED";
  if (upper.includes("CONTRACT")) return "CONTRACT_UPDATED";
  if (upper.includes("PAYMENT")) return "PAYMENT_RECORDED";
  if (upper.includes("PRODUCTION")) return "PRODUCTION_UPDATED";
  if (upper.includes("KP") || upper.includes("QUOTE")) return "KP_APPROVED";
  return "SYSTEM";
}

export function buildDealTimeline(aggregate: DealHubAggregate): DealTimelineEventItem[] {
  const stageEvents: DealTimelineEventItem[] = aggregate.stageHistory.map((item) => ({
    id: `stage-${item.id}`,
    type: "STAGE_CHANGED",
    title: `${item.fromStage?.name ?? "Start"} -> ${item.toStage.name}`,
    occurredAt: item.changedAt.toISOString(),
    actorName: item.changedBy?.name ?? item.changedBy?.email ?? null,
  }));

  const activityEvents: DealTimelineEventItem[] = aggregate.timelineActivity.map((item) => ({
    id: `activity-${item.id}`,
    type: mapActivityTypeToTimelineType(item.type),
    title: item.type,
    occurredAt: item.createdAt.toISOString(),
    actorName: item.actorUser?.name ?? item.actorUser?.email ?? null,
  }));

  return [...stageEvents, ...activityEvents]
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, 60);
}
