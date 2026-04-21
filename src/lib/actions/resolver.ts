import type { DealWorkspacePayload, DealWorkspaceTabId } from "@/features/deal-workspace/types";
import type { LeadCoreInput } from "@/lib/crm-core";
import { getLeadDominantNextStep } from "@/lib/crm-core";

export type WorkflowAction = {
  id: string;
  label: string;
  kind: "navigate" | "tab" | "tel" | "command";
  href?: string;
  tabId?: DealWorkspaceTabId;
  disabled?: boolean;
  reason?: string | null;
};

export type ActionPlan = {
  primary: WorkflowAction;
  secondary: WorkflowAction[];
  quick: WorkflowAction[];
};

function routeForLead(lead: LeadCoreInput): string | null {
  const cta = getLeadDominantNextStep(lead);
  if (!cta.route || cta.disabled) return null;
  return cta.anchorSection ? `${cta.route}#lead-${cta.anchorSection}` : cta.route;
}

export function resolveLeadActionPlan(lead: LeadCoreInput): ActionPlan {
  const cta = getLeadDominantNextStep(lead);
  const primary: WorkflowAction = {
    id: cta.actionKey,
    label: cta.labelUa,
    kind: "navigate",
    href: routeForLead(lead) ?? undefined,
    disabled: cta.disabled,
    reason: cta.reasonUa,
  };

  const secondary: WorkflowAction[] = [
    {
      id: "assign_owner",
      label: "Призначити менеджера",
      kind: "navigate",
      href: `/leads/${lead.id}#lead-hub`,
      disabled: lead.ownerAssigned,
      reason: lead.ownerAssigned ? "Відповідальний вже вказаний" : null,
    },
    {
      id: "upload_file",
      label: "Додати файл",
      kind: "navigate",
      href: `/leads/${lead.id}#lead-files`,
    },
    {
      id: "create_task",
      label: "Створити задачу",
      kind: "navigate",
      href: `/leads/${lead.id}#lead-next-action`,
    },
  ];

  const quick: WorkflowAction[] = [
    {
      id: "open_timeline",
      label: "Таймлайн",
      kind: "navigate",
      href: `/leads/${lead.id}?tab=activity`,
    },
    {
      id: "open_estimate",
      label: "Розрахунок",
      kind: "navigate",
      href: `/leads/${lead.id}/pricing`,
    },
  ];

  return { primary, secondary, quick };
}

export function resolveDealActionPlan(data: DealWorkspacePayload): ActionPlan {
  const hasPhone = Boolean(data.primaryContact?.phone?.trim());
  const isOpenDeal = data.deal.status === "OPEN" || data.deal.status === "ON_HOLD";

  const primary: WorkflowAction = data.meta.nextStepLabel?.trim()
    ? {
        id: "follow_next_step",
        label: data.meta.nextStepLabel.trim(),
        kind: "command",
      }
    : {
        id: "set_next_step",
        label: "Оновити наступний крок",
        kind: "command",
      };

  const secondary: WorkflowAction[] = [
    { id: "messages", label: "Повідомлення", kind: "tab", tabId: "messages" },
    { id: "tasks", label: "Задачі", kind: "tab", tabId: "tasks" },
    { id: "payment", label: "Оплата", kind: "tab", tabId: "payment" },
  ];

  const quick: WorkflowAction[] = [
    {
      id: "call",
      label: "Дзвінок",
      kind: "tel",
      href: hasPhone
        ? `tel:${data.primaryContact?.phone?.replace(/\s+/g, "")}`
        : undefined,
      disabled: !hasPhone,
      reason: !hasPhone ? "Немає телефону" : null,
    },
    {
      id: "mark_won",
      label: "Виграно",
      kind: "command",
      disabled: !isOpenDeal,
      reason: !isOpenDeal ? "Замовлення вже завершена" : null,
    },
    {
      id: "mark_lost",
      label: "Втрачено",
      kind: "command",
      disabled: !isOpenDeal,
      reason: !isOpenDeal ? "Замовлення вже завершена" : null,
    },
  ];

  return { primary, secondary, quick };
}
