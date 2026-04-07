/**
 * Ключі тригерів для `AutomationRule.trigger` (§9).
 * Правила в БД поки лише створюють `AutomationRun` (див. `dispatchAutomationTrigger`).
 */
export const DEAL_AUTOMATION_TRIGGERS = {
  DEAL_CREATED: "deal.created",
  DEAL_STAGE_CHANGED: "deal.stage_changed",
  PAYMENT_RECEIVED: "payment.received",
  TASK_OVERDUE: "task.overdue",
  PRODUCTION_DELAYED: "production.delayed",
  QUOTE_APPROVED: "quote.approved",
  CONTRACT_SIGNED: "contract.signed",
  PROCUREMENT_CREATED: "procurement.created",
  PRODUCTION_STARTED: "production.started",
  CONTRACT_CREATED: "deal.contract_created",
  CONTRACT_SENT: "deal.contract_sent",
  CONTRACT_SIGNED_LEGACY: "deal.contract_signed",
  PAYMENT_ADDED: "deal.payment_added",
  PAYMENT_PAID: "deal.payment_paid",
  INSTALLATION_SCHEDULED: "deal.installation_scheduled",
} as const;

export const LEAD_AUTOMATION_TRIGGERS = {
  LEAD_CREATED: "lead.created",
  NO_ANSWER_LOGGED: "lead.communication_no_answer",
  MESSAGE_SENT: "lead.communication_message_sent",
  MEASUREMENT_COMPLETED: "lead.measurement_completed",
  ESTIMATE_CURRENT: "lead.estimate_set_current",
  PROPOSAL_SENT: "lead.proposal_sent",
  PROPOSAL_VIEWED: "lead.proposal_viewed",
  PROPOSAL_APPROVED: "lead.proposal_approved",
} as const;

export const CONVERSION_AUTOMATION_TRIGGERS = {
  LEAD_CONVERTED: "conversion.lead_converted",
} as const;
