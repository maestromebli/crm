import type { DealContractStatus } from "@prisma/client";
import type { LeadDetailRow } from "../../../features/leads/queries";
import type { DealWorkspacePayload } from "../../../features/deal-workspace/types";
import type { AssistantPageEntitySnapshot } from "../context/AssistantPageEntityContext";

function hoursSince(d: Date | null): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / 3600000);
}

function collectLeadMissing(lead: LeadDetailRow): string[] {
  const m: string[] = [];
  if (!lead.contact?.phone?.trim() && !lead.phone?.trim()) {
    m.push("телефон");
  }
  if (!lead.nextStep?.trim()) {
    m.push("наступний крок");
  }
  if (
    lead.nextContactAt &&
    new Date(lead.nextContactAt).getTime() < Date.now()
  ) {
    m.push("наступний контакт (дата минула)");
  }
  return m;
}

function collectDealMissing(data: DealWorkspacePayload): string[] {
  return data.readiness
    .filter((x) => !x.done)
    .slice(0, 6)
    .map((x) => x.label);
}

function formatDealPayment(data: DealWorkspacePayload): string | null {
  const c = data.contract;
  if (!c) {
    return "договір не створено";
  }
  const short: Record<DealContractStatus, string> = {
    DRAFT: "чернетка договору",
    GENERATED: "договір згенеровано",
    EDITED: "договір відредаговано",
    PENDING_INTERNAL_APPROVAL: "внутрішнє погодження",
    APPROVED_INTERNAL: "погоджено всередині",
    SENT_FOR_SIGNATURE: "на підписі у клієнта",
    VIEWED_BY_CLIENT: "клієнт переглянув договір",
    CLIENT_SIGNED: "підпис клієнта отримано",
    COMPANY_SIGNED: "підпис компанії",
    FULLY_SIGNED: "договір повністю підписано",
    DECLINED: "підпис відхилено",
    EXPIRED: "строк підпису минув",
    SUPERSEDED: "замінено новою версією",
  };
  return short[c.status] ?? `договір: ${String(c.status)}`;
}

export function buildLeadPageEntitySnapshot(
  lead: LeadDetailRow,
  extras?: { overdueOpenTasks?: number },
): AssistantPageEntitySnapshot {
  const quoteStatus =
    lead.proposals[0]?.status != null
      ? String(lead.proposals[0].status)
      : null;

  return {
    kind: "lead",
    entityId: lead.id,
    title: lead.title,
    statusLabel: lead.stage?.name ?? null,
    overdueTasks: extras?.overdueOpenTasks ?? 0,
    staleSinceHours: hoursSince(lead.lastActivityAt),
    quoteStatus,
    paymentStatus: null,
    missingFieldLabels: collectLeadMissing(lead),
  };
}

export function buildDealPageEntitySnapshot(
  data: DealWorkspacePayload,
): AssistantPageEntitySnapshot {
  const lastAt = data.operationalStats.lastActivityAt
    ? new Date(data.operationalStats.lastActivityAt)
    : null;

  return {
    kind: "deal",
    entityId: data.deal.id,
    title: data.deal.title,
    statusLabel: data.stage.name,
    overdueTasks: data.operationalStats.overdueOpenTasksCount,
    staleSinceHours: hoursSince(lastAt),
    quoteStatus: data.operationalStats.latestEstimate?.status ?? null,
    paymentStatus: formatDealPayment(data),
    missingFieldLabels: collectDealMissing(data),
  };
}
