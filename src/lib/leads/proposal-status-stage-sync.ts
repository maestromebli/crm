import type { LeadProposalStatus, Prisma } from "@prisma/client";
import type { LeadStageKey } from "@/lib/crm-core/lead-stage.types";
import { resolveLeadStageKey } from "@/lib/crm-core/lead-stage-resolve";

export type ProposalStageSyncResult = {
  applied: boolean;
  targetStageKey: LeadStageKey | null;
  fromStageId: string | null;
  toStageId: string | null;
  reason:
    | "no_stage_mapping"
    | "lead_not_found"
    | "lead_already_converted"
    | "stage_not_found_in_pipeline"
    | "already_on_target_stage"
    | null;
};

export function mapProposalStatusToLeadStageKey(
  status: LeadProposalStatus,
): LeadStageKey | null {
  switch (status) {
    case "DRAFT":
    case "READY_TO_SEND":
      return "QUOTE_DRAFT";
    case "SENT":
    case "CLIENT_REVIEWING":
      return "QUOTE_SENT";
    case "APPROVED":
      return "APPROVED";
    case "REJECTED":
      return "CALCULATION";
    case "SUPERSEDED":
      return "QUOTE_DRAFT";
    default:
      return null;
  }
}

export async function syncLeadStageFromProposalStatus(
  db: Pick<Prisma.TransactionClient, "lead" | "pipelineStage">,
  args: { leadId: string; status: LeadProposalStatus },
): Promise<ProposalStageSyncResult> {
  const targetStageKey = mapProposalStatusToLeadStageKey(args.status);
  if (!targetStageKey) {
    return {
      applied: false,
      targetStageKey: null,
      fromStageId: null,
      toStageId: null,
      reason: "no_stage_mapping",
    };
  }

  const lead = await db.lead.findUnique({
    where: { id: args.leadId },
    select: { id: true, stageId: true, pipelineId: true, dealId: true },
  });
  if (!lead) {
    return {
      applied: false,
      targetStageKey,
      fromStageId: null,
      toStageId: null,
      reason: "lead_not_found",
    };
  }
  if (lead.dealId) {
    return {
      applied: false,
      targetStageKey,
      fromStageId: lead.stageId,
      toStageId: null,
      reason: "lead_already_converted",
    };
  }

  const stages = await db.pipelineStage.findMany({
    where: { pipelineId: lead.pipelineId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      isFinal: true,
      finalType: true,
    },
  });
  const targetStage = stages.find((stage) => {
    return (
      resolveLeadStageKey(stage.slug, {
        isFinal: stage.isFinal,
        finalType: stage.finalType,
        stageName: stage.name,
      }) === targetStageKey
    );
  });

  if (!targetStage) {
    return {
      applied: false,
      targetStageKey,
      fromStageId: lead.stageId,
      toStageId: null,
      reason: "stage_not_found_in_pipeline",
    };
  }
  if (targetStage.id === lead.stageId) {
    return {
      applied: false,
      targetStageKey,
      fromStageId: lead.stageId,
      toStageId: targetStage.id,
      reason: "already_on_target_stage",
    };
  }

  await db.lead.update({
    where: { id: lead.id },
    data: { stageId: targetStage.id },
  });

  return {
    applied: true,
    targetStageKey,
    fromStageId: lead.stageId,
    toStageId: targetStage.id,
    reason: null,
  };
}
