export type DealTimelineEventType =
  | "DEAL_CREATED"
  | "STAGE_CHANGED"
  | "PRICING_UPDATED"
  | "KP_APPROVED"
  | "CONTRACT_UPDATED"
  | "PAYMENT_RECORDED"
  | "MEASUREMENT_UPDATED"
  | "CONSTRUCTOR_UPDATED"
  | "PRODUCTION_UPDATED"
  | "PROCUREMENT_UPDATED"
  | "INSTALLATION_UPDATED"
  | "SYSTEM";

export type DealTimelineEventItem = {
  id: string;
  type: DealTimelineEventType;
  title: string;
  description?: string;
  occurredAt: string;
  actorName: string | null;
  relatedEntityType?: string;
  relatedEntityId?: string;
  severity?: "default" | "critical";
};
