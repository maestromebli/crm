import {
  emitLeadWorkflowEvent,
  subscribeLeadWorkflow,
  type LeadWorkflowEventMap,
  type LeadWorkflowEventName,
} from "@/lib/events/lead-workflow-bus";

export type { LeadWorkflowEventMap, LeadWorkflowEventName };
export { emitLeadWorkflowEvent, subscribeLeadWorkflow };

export const leadEventBus = {
  emit: emitLeadWorkflowEvent,
  subscribe: subscribeLeadWorkflow,
};
