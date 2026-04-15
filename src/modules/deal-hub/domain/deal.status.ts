export const DEAL_HUB_STAGE_ORDER = [
  "NEW",
  "PRICING",
  "KP_PREPARED",
  "KP_APPROVED",
  "CONTRACT",
  "PREPAYMENT",
  "MEASUREMENT",
  "TECHNICAL_DESIGN",
  "PRODUCTION_READY",
  "PRODUCTION",
  "PROCUREMENT",
  "DELIVERY_READY",
  "INSTALLATION",
  "FINAL_PAYMENT",
  "CLOSED",
] as const;

export type DealHubStage = (typeof DEAL_HUB_STAGE_ORDER)[number];

export const DEAL_HUB_HEALTH_ORDER = [
  "GOOD",
  "WARNING",
  "RISK",
  "CRITICAL",
] as const;

export type DealHubHealthStatus = (typeof DEAL_HUB_HEALTH_ORDER)[number];

export const DEAL_HUB_PRIORITY_ORDER = [
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
  "CRITICAL",
] as const;

export type DealHubPriority = (typeof DEAL_HUB_PRIORITY_ORDER)[number];

export function normalizeDealHubStage(stageSlug?: string | null): DealHubStage {
  const slug = (stageSlug ?? "").toUpperCase().trim();
  const map: Record<string, DealHubStage> = {
    NEW: "NEW",
    QUALIFICATION: "NEW",
    PRICING: "PRICING",
    PROPOSAL: "KP_PREPARED",
    KP_PREPARED: "KP_PREPARED",
    KP_APPROVED: "KP_APPROVED",
    CONTRACT: "CONTRACT",
    PREPAYMENT: "PREPAYMENT",
    PAYMENT: "PREPAYMENT",
    MEASUREMENT: "MEASUREMENT",
    TECHNICAL_DESIGN: "TECHNICAL_DESIGN",
    HANDOFF: "TECHNICAL_DESIGN",
    PRODUCTION_READY: "PRODUCTION_READY",
    PRODUCTION: "PRODUCTION",
    PROCUREMENT: "PROCUREMENT",
    DELIVERY_READY: "DELIVERY_READY",
    INSTALLATION: "INSTALLATION",
    FINAL_PAYMENT: "FINAL_PAYMENT",
    CLOSED: "CLOSED",
    WON: "CLOSED",
  };
  return map[slug] ?? "NEW";
}
