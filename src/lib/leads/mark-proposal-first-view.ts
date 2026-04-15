import type { LeadProposalStatus } from "@prisma/client";
import { prisma, prismaCodegenIncludesLeadProposalViewedAt } from "../prisma";
import { syncLeadStageFromProposalStatus } from "./proposal-status-stage-sync";

/**
 * Фіксує перший перегляд публічного КП (`viewedAt` + за потреби `CLIENT_REVIEWING`).
 * Якщо згенерований клієнт не містить `viewedAt` у схемі — no-op (старий generate).
 */
export async function ensureLeadProposalFirstViewRecorded(proposal: {
  id: string;
  status: LeadProposalStatus;
  viewedAt?: Date | null;
}): Promise<void> {
  if (!prismaCodegenIncludesLeadProposalViewedAt()) return;
  if (proposal.viewedAt) return;
  const nextStatus: LeadProposalStatus =
    proposal.status === "DRAFT" || proposal.status === "SENT"
      ? "CLIENT_REVIEWING"
      : proposal.status;
  const updated = await prisma.leadProposal.update({
    where: { id: proposal.id },
    data: {
      viewedAt: new Date(),
      status: nextStatus,
    },
  });
  if (nextStatus !== proposal.status) {
    await syncLeadStageFromProposalStatus(prisma, {
      leadId: updated.leadId,
      status: nextStatus,
    });
  }
}
