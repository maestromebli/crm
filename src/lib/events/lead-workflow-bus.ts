/**
 * Легкий клієнтський шина подій для реактивного Hub (без дублювання серверного `crm-events`).
 */

export type LeadWorkflowEventMap = {
  "lead.created": { leadId: string };
  "lead.stage.changed": { leadId: string; stageId: string; stageSlug?: string };
  "measurement.completed": { leadId: string; eventId: string };
  "estimate.created": { leadId: string; estimateId: string };
  "quote.sent": { leadId: string; proposalId: string };
  "quote.approved": { leadId: string; proposalId: string };
  "contract.created": { leadId: string; dealId?: string | null };
  "file.uploaded": { leadId: string; attachmentId: string; category?: string };
};

export type LeadWorkflowEventName = keyof LeadWorkflowEventMap;

type Handler<K extends LeadWorkflowEventName> = (
  payload: LeadWorkflowEventMap[K],
) => void;

const listeners = new Map<
  LeadWorkflowEventName,
  Set<Handler<LeadWorkflowEventName>>
>();

export function subscribeLeadWorkflow<K extends LeadWorkflowEventName>(
  name: K,
  handler: Handler<K>,
): () => void {
  let set = listeners.get(name);
  if (!set) {
    set = new Set();
    listeners.set(name, set);
  }
  set.add(handler as Handler<LeadWorkflowEventName>);
  return () => {
    set?.delete(handler as Handler<LeadWorkflowEventName>);
  };
}

export function emitLeadWorkflowEvent<K extends LeadWorkflowEventName>(
  name: K,
  payload: LeadWorkflowEventMap[K],
): void {
  const set = listeners.get(name);
  if (!set) return;
  for (const h of set) {
    try {
      h(payload as LeadWorkflowEventMap[typeof name]);
    } catch {
      // ізольовані підписники — не ламаємо UI
    }
  }
}
