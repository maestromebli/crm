import type { AiV2EventType } from "./types";

export const AI_V2_EVENT_TYPES: Record<AiV2EventType, AiV2EventType> = {
  lead_created: "lead_created",
  lead_updated: "lead_updated",
  manager_assigned: "manager_assigned",
  contact_logged: "contact_logged",
  measurement_scheduled: "measurement_scheduled",
  measurement_done: "measurement_done",
  file_uploaded: "file_uploaded",
  estimate_version_created: "estimate_version_created",
  quote_sent: "quote_sent",
  quote_viewed: "quote_viewed",
  quote_approved: "quote_approved",
  contract_created: "contract_created",
  payment_expected: "payment_expected",
  payment_received: "payment_received",
  payment_overdue: "payment_overdue",
  purchase_needed: "purchase_needed",
  production_ready_check: "production_ready_check",
  constructor_question_opened: "constructor_question_opened",
  production_approved: "production_approved",
  mount_scheduled: "mount_scheduled",
};

const AI_V2_EVENT_TYPE_SET = new Set<string>(Object.keys(AI_V2_EVENT_TYPES));

export function isAiV2EventType(value: string): value is AiV2EventType {
  return AI_V2_EVENT_TYPE_SET.has(value);
}
