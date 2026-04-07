import type { DealWorkspacePayload } from "../deal-core/workspace-types";
import type { LeadDetailRow } from "../../features/leads/queries";
import {
  buildLeadAiHints,
  computeLeadRisks,
  getCTA,
  getStageReadinessSnapshot,
  mapLeadDetailRowToCoreInput,
} from "../crm-core";
import { deriveDynamicNextAction } from "./next-action-engine";
import type { SmartPanelContext } from "./types";

type BuildOptions = {
  permissions?: string[];
};

export function buildLeadSmartPanelContext(
  lead: LeadDetailRow,
  opts?: BuildOptions,
): SmartPanelContext {
  const coreInput = mapLeadDetailRowToCoreInput(lead);
  const readiness = getStageReadinessSnapshot(coreInput);
  const cta = getCTA(coreInput);
  const risks = computeLeadRisks(coreInput);
  const aiHints = buildLeadAiHints(coreInput).slice(0, 5);

  const dynamicNext = deriveDynamicNextAction({
    hasContact: Boolean(lead.contactId || lead.contact),
    hasEstimate: lead.estimates.length > 0,
    quoteSentAt:
      lead.proposals.find((x) => x.status === "SENT")?.sentAt?.toISOString() ?? null,
  });

  const missingData: string[] = [];
  if (!lead.contactId && !lead.contact) missingData.push("contact");
  if (lead.estimates.length === 0) missingData.push("estimate");
  if (!lead.nextStep && !lead.nextContactAt) missingData.push("next_step");

  return {
    entityType: "LEAD",
    entityId: lead.id,
    status: lead.stage.slug,
    lastActivityAt: lead.lastActivityAt?.toISOString() ?? null,
    missingData,
    permissions: opts?.permissions ?? [],
    nextAction: dynamicNext ?? {
      label: cta.labelUa,
      action: cta.actionKey,
      priority: cta.severity === "warning" ? "high" : "medium",
    },
    riskMeter: Math.min(100, risks.items.length * 20),
    risks: risks.items.map((x) => x.messageUa),
    checklist: readiness.items.map((x) => ({
      id: x.key,
      label: x.labelUa,
      done: x.state === "ready",
    })),
    aiHints: aiHints.map((x) => x.textUa),
    recentEvents: [],
  };
}

export function buildDealSmartPanelContext(
  data: DealWorkspacePayload,
  opts?: BuildOptions,
): SmartPanelContext {
  const sentProposalAt = data.meta.proposalSent ? data.deal.updatedAt : null;
  const nextAction = deriveDynamicNextAction({
    hasContact: Boolean(data.primaryContact),
    hasEstimate: data.operationalStats.estimatesCount > 0,
    quoteSentAt: sentProposalAt,
  });

  const missingData: string[] = [];
  if (!data.primaryContact) missingData.push("contact");
  if (!data.meta.measurementComplete) missingData.push("measurement");
  if (!data.meta.proposalSent) missingData.push("proposal");

  return {
    entityType: "DEAL",
    entityId: data.deal.id,
    status: data.stage.slug,
    lastActivityAt: data.operationalStats.lastActivityAt,
    missingData,
    permissions: opts?.permissions ?? [],
    nextAction,
    riskMeter: Math.min(100, data.readiness.filter((x) => !x.done).length * 20),
    risks: data.readiness
      .filter((x) => !x.done)
      .map((x) => x.blockerMessage ?? x.label),
    checklist: data.readiness.map((x) => ({
      id: x.id,
      label: x.label,
      done: x.done,
    })),
    aiHints: [],
    recentEvents: [],
  };
}
