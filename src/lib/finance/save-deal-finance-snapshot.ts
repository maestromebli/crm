import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { computeDealFinanceRollup } from "./deal-finance-rollup";
import { logDealFinanceActivity } from "./log-deal-finance-activity";

/** Зберігає знімок P&L по угоді (append-only рядок). */
export async function saveDealFinanceSnapshot(args: {
  dealId: string;
  source?: string;
  actorUserId?: string | null;
  meta?: Prisma.InputJsonValue;
}): Promise<{ id: string }> {
  const rollup = await computeDealFinanceRollup(args.dealId);
  const row = await prisma.dealFinanceSnapshot.create({
    data: {
      dealId: args.dealId,
      revenueUah: rollup.revenueUah,
      expensesUah: rollup.expensesUah,
      profitUah: rollup.profitUah,
      marginPct: rollup.marginPct,
      source: args.source ?? "rollup",
      metaJson: args.meta ?? {
        paidClientUah: rollup.paidClientUah.toString(),
      },
    },
    select: { id: true },
  });

  if (args.actorUserId) {
    await logDealFinanceActivity({
      dealId: args.dealId,
      actorUserId: args.actorUserId,
      type: "DEAL_FINANCE_SNAPSHOT_SAVED",
      data: { snapshotId: row.id, source: args.source ?? "rollup" },
    });
  }

  return row;
}
