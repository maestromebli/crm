export const WORKFLOW_EVENT_TYPES = {
  LEAD_CREATED: "lead_created",
  LEAD_ASSIGNED: "lead_assigned",
  CONTACT_COMPLETED: "contact_completed",
  MEASUREMENT_SCHEDULED: "measurement_scheduled",
  MEASUREMENT_DONE: "measurement_done",
  CALCULATION_VERSION_CREATED: "calculation_version_created",
  CALCULATION_VERSION_SELECTED: "calculation_version_selected",
  QUOTE_CREATED: "quote_created",
  QUOTE_SENT: "quote_sent",
  QUOTE_VIEWED: "quote_viewed",
  QUOTE_APPROVED: "quote_approved",
  QUOTE_REJECTED: "quote_rejected",
  DEAL_CREATED: "deal_created",
  CONTRACT_DRAFT_CREATED: "contract_draft_created",
  CONTRACT_SIGNED: "contract_signed",
  INVOICE_CREATED: "invoice_created",
  PAYMENT_RECEIVED: "payment_received",
  CONTROL_MEASUREMENT_SCHEDULED: "control_measurement_scheduled",
  CONTROL_MEASUREMENT_DONE: "control_measurement_done",
  FILE_UPLOADED: "file_uploaded",
  FILE_APPROVED: "file_approved",
  TASK_CREATED: "task_created",
  TASK_OVERDUE: "task_overdue",
  FOLLOW_UP_REQUIRED: "follow_up_required",
  AI_ALERT_CREATED: "ai_alert_created",
  TELEGRAM_MESSAGE_SYNCED: "telegram_message_synced",
  PRODUCTION_TRANSFERRED: "production_transferred",
} as const;

export type WorkflowEventType =
  (typeof WORKFLOW_EVENT_TYPES)[keyof typeof WORKFLOW_EVENT_TYPES];

export type WorkflowEventPayloadMap = {
  [WORKFLOW_EVENT_TYPES.LEAD_CREATED]: { leadId: string };
  [WORKFLOW_EVENT_TYPES.LEAD_ASSIGNED]: { leadId: string; ownerId: string };
  [WORKFLOW_EVENT_TYPES.CONTACT_COMPLETED]: { leadId: string };
  [WORKFLOW_EVENT_TYPES.MEASUREMENT_SCHEDULED]: { leadId: string; eventId: string };
  [WORKFLOW_EVENT_TYPES.MEASUREMENT_DONE]: { leadId: string; eventId: string };
  [WORKFLOW_EVENT_TYPES.CALCULATION_VERSION_CREATED]: { leadId: string; estimateId: string };
  [WORKFLOW_EVENT_TYPES.CALCULATION_VERSION_SELECTED]: { leadId: string; estimateId: string };
  [WORKFLOW_EVENT_TYPES.QUOTE_CREATED]: {
    leadId?: string;
    dealId?: string;
    proposalId: string;
  };
  [WORKFLOW_EVENT_TYPES.QUOTE_SENT]: {
    leadId?: string;
    dealId?: string;
    proposalId: string;
  };
  [WORKFLOW_EVENT_TYPES.QUOTE_VIEWED]: {
    leadId?: string;
    dealId?: string;
    proposalId: string;
  };
  [WORKFLOW_EVENT_TYPES.QUOTE_APPROVED]: {
    leadId?: string;
    dealId?: string;
    proposalId: string;
  };
  [WORKFLOW_EVENT_TYPES.QUOTE_REJECTED]: {
    leadId?: string;
    dealId?: string;
    proposalId: string;
  };
  [WORKFLOW_EVENT_TYPES.DEAL_CREATED]: { dealId: string; leadId?: string };
  [WORKFLOW_EVENT_TYPES.CONTRACT_DRAFT_CREATED]: { dealId: string; contractId: string };
  [WORKFLOW_EVENT_TYPES.CONTRACT_SIGNED]: { dealId: string; contractId: string };
  [WORKFLOW_EVENT_TYPES.INVOICE_CREATED]: { dealId: string; invoiceId: string };
  [WORKFLOW_EVENT_TYPES.PAYMENT_RECEIVED]: { dealId: string; paymentId?: string };
  [WORKFLOW_EVENT_TYPES.CONTROL_MEASUREMENT_SCHEDULED]: { dealId: string; eventId: string };
  [WORKFLOW_EVENT_TYPES.CONTROL_MEASUREMENT_DONE]: { dealId: string; eventId: string };
  [WORKFLOW_EVENT_TYPES.FILE_UPLOADED]: {
    leadId?: string;
    dealId?: string;
    attachmentId: string;
  };
  [WORKFLOW_EVENT_TYPES.FILE_APPROVED]: { dealId: string; attachmentId: string };
  [WORKFLOW_EVENT_TYPES.TASK_CREATED]: { leadId?: string; dealId?: string; taskId: string };
  [WORKFLOW_EVENT_TYPES.TASK_OVERDUE]: { leadId?: string; dealId?: string; taskId: string };
  [WORKFLOW_EVENT_TYPES.FOLLOW_UP_REQUIRED]: { leadId?: string; dealId?: string };
  [WORKFLOW_EVENT_TYPES.AI_ALERT_CREATED]: { leadId?: string; dealId?: string; note: string };
  [WORKFLOW_EVENT_TYPES.TELEGRAM_MESSAGE_SYNCED]: { leadId?: string; dealId?: string };
  [WORKFLOW_EVENT_TYPES.PRODUCTION_TRANSFERRED]: { dealId: string };
};
