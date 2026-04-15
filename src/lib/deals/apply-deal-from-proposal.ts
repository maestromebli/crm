import type { Prisma } from "@prisma/client";

import type { DealWorkspaceMeta } from "@/lib/deal-core/workspace-types";
import {
  buildDealCommercialSnapshotV1,
  currencyFromProposalSnapshotJson,
  totalFromProposalSnapshotJson,
} from "./commercial-snapshot";
import { seedDealPaymentPlan7030 } from "./payment-milestones";

async function getDealColumnNames(
  tx: Prisma.TransactionClient,
): Promise<Set<string>> {
  try {
    const rows = await tx.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name IN ('Deal', 'deal')
    `;
    return new Set(rows.map((r) => r.column_name));
  } catch {
    return new Set<string>();
  }
}

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
  const dealColumnNames = await getDealColumnNames(tx);
  const supportsColumn = (name: string): boolean =>
    dealColumnNames.size === 0 || dealColumnNames.has(name);

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

  const dealUpdateData: Prisma.DealUpdateInput = {
    ...(supportsColumn("commercialSnapshotJson")
      ? {
          commercialSnapshotJson:
            commercial as unknown as Prisma.InputJsonValue,
        }
      : {}),
    ...(supportsColumn("commercialSnapshotSourceProposalId")
      ? { commercialSnapshotSourceProposalId: proposal.id }
      : {}),
    ...(supportsColumn("commercialSnapshotFrozenAt")
      ? { commercialSnapshotFrozenAt: frozenAt }
      : {}),
    ...(total != null &&
    total > 0 &&
    supportsColumn("value") &&
    supportsColumn("currency")
      ? { value: total, currency: cur }
      : {}),
    ...(supportsColumn("workspaceMeta") ? { workspaceMeta: merged } : {}),
  };

  if (Object.keys(dealUpdateData).length === 0) {
    return;
  }

  await tx.deal.update({
    where: { id: args.dealId },
    data: dealUpdateData,
  });
}
