import type { DealWorkspacePayload } from "@/features/deal-workspace/types";

export function applyOptimisticDealStatus(
  previous: DealWorkspacePayload,
  status: string,
): DealWorkspacePayload {
  if (previous.deal.status === status) return previous;
  return {
    ...previous,
    deal: {
      ...previous.deal,
      status,
    },
  };
}

export function applyOptimisticDealStage(
  previous: DealWorkspacePayload,
  stageId: string,
): DealWorkspacePayload {
  if (previous.stage.id === stageId) return previous;
  const next = previous.stages.find((s) => s.id === stageId);
  if (!next) return previous;
  return {
    ...previous,
    stage: {
      ...previous.stage,
      id: next.id,
      name: next.name,
      slug: next.slug,
      sortOrder: next.sortOrder,
    },
  };
}

