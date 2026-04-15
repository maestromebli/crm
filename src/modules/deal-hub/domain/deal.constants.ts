import type { DealHubStage } from "./deal.status";

export const DEAL_HUB_STAGE_LABELS: Record<DealHubStage, string> = {
  NEW: "New",
  PRICING: "Pricing",
  KP_PREPARED: "KP Prepared",
  KP_APPROVED: "KP Approved",
  CONTRACT: "Contract",
  PREPAYMENT: "Prepayment",
  MEASUREMENT: "Measurement",
  TECHNICAL_DESIGN: "Technical Design",
  PRODUCTION_READY: "Production Ready",
  PRODUCTION: "Production",
  PROCUREMENT: "Procurement",
  DELIVERY_READY: "Delivery Ready",
  INSTALLATION: "Installation",
  FINAL_PAYMENT: "Final Payment",
  CLOSED: "Closed",
};

export const DEAL_HUB_TARGET_MARGIN_PCT = 25;
