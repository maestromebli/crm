export const EVENT_FAMILIES = {
  LEAD: "lead",
  DEAL: "deal",
  PRODUCTION: "production",
  AI_AUTOMATION: "ai_automation",
} as const;

export type EventFamily = (typeof EVENT_FAMILIES)[keyof typeof EVENT_FAMILIES];

export const CANONICAL_EVENT_TYPES = {
  // Lead lifecycle
  LEAD_CREATED: "lead_created",
  LEAD_ASSIGNED: "lead_assigned",
  LEAD_CONTACTED: "lead_contacted",
  MEASUREMENT_PLANNED: "measurement_planned",
  MEASUREMENT_DONE: "measurement_done",
  ESTIMATE_CREATED: "estimate_created",
  QUOTE_SENT: "quote_sent",
  QUOTE_APPROVED: "quote_approved",
  CONVERTED_TO_DEAL: "converted_to_deal",

  // Deal lifecycle
  CONTRACT_GENERATED: "contract_generated",
  CONTRACT_SIGNED: "contract_signed",
  INVOICE_CREATED: "invoice_created",
  PAYMENT_RECEIVED: "payment_received",
  CONTROL_MEASUREMENT_DONE: "control_measurement_done",
  SENT_TO_PRODUCTION: "sent_to_production",
  STATUS_CHANGED: "status_changed",
  FILE_UPLOADED: "file_uploaded",

  // Production lifecycle
  CONSTRUCTOR_ASSIGNED: "constructor_assigned",
  PRODUCTION_FILES_UPLOADED: "production_files_uploaded",
  APPROVAL_REQUESTED: "approval_requested",
  APPROVAL_GRANTED: "approval_granted",
  PROCUREMENT_STARTED: "procurement_started",
  INSTALLATION_SCHEDULED: "installation_scheduled",
  INSTALLATION_COMPLETED: "installation_completed",

  // AI and automation lifecycle
  SUGGESTION_GENERATED: "suggestion_generated",
  TASK_AUTO_CREATED: "task_auto_created",
  REMINDER_TRIGGERED: "reminder_triggered",
  ESCALATION_TRIGGERED: "escalation_triggered",
  POLICY_BLOCKER_RAISED: "policy_blocker_raised",
} as const;

export type CanonicalEventType =
  (typeof CANONICAL_EVENT_TYPES)[keyof typeof CANONICAL_EVENT_TYPES];

const LEGACY_TO_CANONICAL: Record<string, CanonicalEventType | null> = {
  "deal.created": CANONICAL_EVENT_TYPES.CONVERTED_TO_DEAL,
  "stage.changed": CANONICAL_EVENT_TYPES.STATUS_CHANGED,
  "quote.approved": CANONICAL_EVENT_TYPES.QUOTE_APPROVED,
  "contract.signed": CANONICAL_EVENT_TYPES.CONTRACT_SIGNED,
  "payment.received": CANONICAL_EVENT_TYPES.PAYMENT_RECEIVED,
  "procurement.created": CANONICAL_EVENT_TYPES.PROCUREMENT_STARTED,
  "production.started": CANONICAL_EVENT_TYPES.SENT_TO_PRODUCTION,
  "production.delayed": CANONICAL_EVENT_TYPES.POLICY_BLOCKER_RAISED,
};

export function canonicalEventType(type: string): string {
  return LEGACY_TO_CANONICAL[type] ?? type;
}

export function eventFamilyForType(type: string): EventFamily {
  const normalized = canonicalEventType(type);
  if (
    normalized.startsWith("lead_") ||
    normalized === CANONICAL_EVENT_TYPES.MEASUREMENT_PLANNED ||
    normalized === CANONICAL_EVENT_TYPES.MEASUREMENT_DONE
  ) {
    return EVENT_FAMILIES.LEAD;
  }
  if (
    normalized.startsWith("production_") ||
    normalized.includes("constructor") ||
    normalized.includes("procurement") ||
    normalized.includes("installation") ||
    normalized.includes("approval")
  ) {
    return EVENT_FAMILIES.PRODUCTION;
  }
  if (
    normalized.includes("suggestion") ||
    normalized.includes("auto_") ||
    normalized.includes("reminder") ||
    normalized.includes("escalation") ||
    normalized.includes("policy_blocker") ||
    normalized.startsWith("ai_v2.")
  ) {
    return EVENT_FAMILIES.AI_AUTOMATION;
  }
  return EVENT_FAMILIES.DEAL;
}
