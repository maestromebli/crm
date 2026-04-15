export const EVENT_FAMILIES = {
  LEAD: "lead",
  DEAL: "deal",
  PRODUCTION: "production",
  AI_AUTOMATION: "ai_automation",
} as const;
export const EVENT_CATALOG_SCHEMA_VERSION = "v1";

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
  FINANCIAL_WORKFLOW_COMPLETED: "financial_workflow_completed",
  FINANCIAL_WORKFLOW_FAILED: "financial_workflow_failed",
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

type EventCatalogEntry = {
  type: CanonicalEventType;
  family: EventFamily;
  entityType: "LEAD" | "DEAL" | "PRODUCTION" | "SYSTEM";
  description: string;
};

export const EVENT_CATALOG_V1: readonly EventCatalogEntry[] = [
  {
    type: CANONICAL_EVENT_TYPES.LEAD_CREATED,
    family: EVENT_FAMILIES.LEAD,
    entityType: "LEAD",
    description: "Lead created in CRM intake flow",
  },
  {
    type: CANONICAL_EVENT_TYPES.CONVERTED_TO_DEAL,
    family: EVENT_FAMILIES.LEAD,
    entityType: "LEAD",
    description: "Lead converted to deal",
  },
  {
    type: CANONICAL_EVENT_TYPES.STATUS_CHANGED,
    family: EVENT_FAMILIES.DEAL,
    entityType: "DEAL",
    description: "Deal stage/status changed",
  },
  {
    type: CANONICAL_EVENT_TYPES.CONTRACT_SIGNED,
    family: EVENT_FAMILIES.DEAL,
    entityType: "DEAL",
    description: "Deal contract fully signed",
  },
  {
    type: CANONICAL_EVENT_TYPES.PAYMENT_RECEIVED,
    family: EVENT_FAMILIES.DEAL,
    entityType: "DEAL",
    description: "Deal payment received",
  },
  {
    type: CANONICAL_EVENT_TYPES.FINANCIAL_WORKFLOW_COMPLETED,
    family: EVENT_FAMILIES.DEAL,
    entityType: "DEAL",
    description: "One-click finance workflow completed",
  },
  {
    type: CANONICAL_EVENT_TYPES.FINANCIAL_WORKFLOW_FAILED,
    family: EVENT_FAMILIES.DEAL,
    entityType: "DEAL",
    description: "One-click finance workflow had failed steps",
  },
  {
    type: CANONICAL_EVENT_TYPES.SENT_TO_PRODUCTION,
    family: EVENT_FAMILIES.PRODUCTION,
    entityType: "PRODUCTION",
    description: "Deal transferred into production",
  },
  {
    type: CANONICAL_EVENT_TYPES.PROCUREMENT_STARTED,
    family: EVENT_FAMILIES.PRODUCTION,
    entityType: "PRODUCTION",
    description: "Procurement started for production",
  },
  {
    type: CANONICAL_EVENT_TYPES.POLICY_BLOCKER_RAISED,
    family: EVENT_FAMILIES.AI_AUTOMATION,
    entityType: "SYSTEM",
    description: "System policy blocker raised by automation",
  },
];

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

export function getEventCatalogV1() {
  return {
    version: EVENT_CATALOG_SCHEMA_VERSION,
    events: EVENT_CATALOG_V1,
  };
}
