import type { Prisma } from "@prisma/client";

import type { DealWorkspaceMeta } from "@/lib/deal-core/workspace-types";
import {
  buildDealCommercialSnapshotV1,
  currencyFromProposalSnapshotJson,
  totalFromProposalSnapshotJson,
} from "./commercial-snapshot";
import { seedDealPaymentPlan7030 } from "./payment-milestones";

/**
 * Після створення угоди: знімок КП + графік 70/30, якщо активне КП у статусі APPROVED.
 */
export async function applyCommercialSnapshotFromApprovedProposal(
  tx: Prisma.TransactionClient,
  args: {
    dealId: string;
    baseWorkspaceMeta: Prisma.InputJsonValue;
    activeProposalId: string | null;
  },
): Promise<void> {
  if (!args.activeProposalId) return;

  const proposal = await tx.leadProposal.findUnique({
    where: { id: args.activeProposalId },
    select: {
      id: true,
      version: true,
      status: true,
      title: true,
      snapshotJson: true,
      commercialTermsJson: true,
    },
  });

  if (!proposal || proposal.status !== "APPROVED") return;

  const frozenAt = new Date();
  const commercial = buildDealCommercialSnapshotV1({
    proposal,
    frozenAt,
  });

  const total = totalFromProposalSnapshotJson(proposal.snapshotJson);
  const cur =
    currencyFromProposalSnapshotJson(proposal.snapshotJson) ?? "UAH";

  let payment: DealWorkspaceMeta["payment"] | undefined;
  if (total != null && total > 0) {
    payment = await seedDealPaymentPlan7030(tx, {
      dealId: args.dealId,
      total,
      currency: cur,
    });
  }

  const base = args.baseWorkspaceMeta as Record<string, unknown>;
  const exec =
    (base.executionChecklist as Record<string, unknown> | undefined) ?? {};
  const merged: Prisma.InputJsonValue = {
    ...base,
    executionChecklist: {
      ...exec,
      estimateApproved: true,
    },
    ...(payment ? { payment } : {}),
  };

  await tx.deal.update({
    where: { id: args.dealId },
    data: {
      commercialSnapshotJson: commercial as unknown as Prisma.InputJsonValue,
      commercialSnapshotSourceProposalId: proposal.id,
      commercialSnapshotFrozenAt: frozenAt,
      ...(total != null && total > 0
        ? { value: total, currency: cur }
        : {}),
      workspaceMeta: merged,
    },
  });
}
