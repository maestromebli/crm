import type { DealHubStage } from "./deal.status";

export const DEAL_HUB_STAGE_LABELS: Record<DealHubStage, string> = {
  NEW: "Нова замовлення",
  PRICING: "Ціноутворення",
  KP_PREPARED: "КП підготовлено",
  KP_APPROVED: "КП погоджено",
  CONTRACT: "Договір",
  PREPAYMENT: "Передоплата",
  MEASUREMENT: "Замір",
  TECHNICAL_DESIGN: "Технічний дизайн",
  PRODUCTION_READY: "Готово до виробництва",
  PRODUCTION: "Виробництво",
  PROCUREMENT: "Закупівля",
  DELIVERY_READY: "Готово до доставки",
  INSTALLATION: "Монтаж",
  FINAL_PAYMENT: "Фінальний платіж",
  CLOSED: "Закрито",
};

export const DEAL_HUB_TARGET_MARGIN_PCT = 25;
