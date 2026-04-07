import type { DealWorkspacePayload } from "@/features/deal-workspace/types";
import type { LeadDetailRow } from "@/features/leads/queries";
import { canMoveToNextStage } from "@/lib/deal-os/flow-engine";
import {
  canAdvance,
  getBlockingReasons,
  getNextStage,
  mapLeadDetailRowToCoreInput,
} from "@/lib/crm-core";

export function resolveLeadFlowState(lead: LeadDetailRow) {
  const core = mapLeadDetailRowToCoreInput(lead);
  const nextStage = getNextStage(core.stageKey);
  const blocking = getBlockingReasons(core.stageKey, core, nextStage ?? undefined);
  return {
    stageKey: core.stageKey,
    nextStage,
    canAdvance: canAdvance(core.stageKey, core, nextStage ?? undefined),
    blockers: blocking.missingMessagesUa,
    transitionErrors: blocking.transitionErrorsUa,
  };
}

export function resolveDealFlowState(data: DealWorkspacePayload) {
  const state = canMoveToNextStage({
    currentStageName: data.stage.name,
    currentStageSlug: data.stage.slug,
    hasEstimate: data.operationalStats.estimatesCount > 0,
    hasQuote: Boolean(data.meta.proposalSent),
    quoteApproved: data.meta.proposalSent === true,
    contractSigned: data.contract?.status === "FULLY_SIGNED",
    payment70Done: data.paymentMilestones.some((x) => x.confirmedAt != null),
    procurementCreated: data.linkedFinanceProjects.length > 0,
    productionStarted: data.productionLaunch.status === "LAUNCHED",
  });
  return state;
}
