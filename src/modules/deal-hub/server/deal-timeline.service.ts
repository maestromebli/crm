import type { DealTimelineEventItem } from "../domain/deal-timeline.types";
import { DEAL_HUB_STAGE_LABELS } from "../domain/deal.constants";
import type { DealHubStage } from "../domain/deal.status";
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

function mapActivityTypeToTitle(type: string): string {
  const upper = type.toUpperCase();
  if (upper.includes("DEAL_CREATED")) return "Замовлення створено";
  if (upper.includes("STAGE")) return "Змінено етап замовлення";
  if (upper.includes("CONTRACT")) return "Оновлено договір";
  if (upper.includes("PAYMENT")) return "Зафіксовано оплату";
  if (upper.includes("PRODUCTION")) return "Оновлено виробництво";
  if (upper.includes("KP") || upper.includes("QUOTE")) return "Погоджено КП";
  return "Системна подія";
}

function mapStageNameToLabel(stageName?: string | null): string {
  const normalized = String(stageName ?? "").trim().toUpperCase() as DealHubStage;
  if (normalized in DEAL_HUB_STAGE_LABELS) {
    return DEAL_HUB_STAGE_LABELS[normalized];
  }
  return stageName?.trim() || "Невідомий етап";
}

export function buildDealTimeline(aggregate: DealHubAggregate): DealTimelineEventItem[] {
  const stageEvents: DealTimelineEventItem[] = aggregate.stageHistory.map((item) => ({
    id: `stage-${item.id}`,
    type: "STAGE_CHANGED",
    title: `${mapStageNameToLabel(item.fromStage?.name ?? null)} -> ${mapStageNameToLabel(item.toStage?.name ?? null)}`,
    occurredAt: item.changedAt.toISOString(),
    actorName: item.changedBy?.name ?? item.changedBy?.email ?? null,
  }));

  const activityEvents: DealTimelineEventItem[] = aggregate.timelineActivity.map((item) => ({
    id: `activity-${item.id}`,
    type: mapActivityTypeToTimelineType(item.type),
    title: mapActivityTypeToTitle(item.type),
    occurredAt: item.createdAt.toISOString(),
    actorName: item.actorUser?.name ?? item.actorUser?.email ?? null,
  }));

  return [...stageEvents, ...activityEvents]
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, 60);
}
