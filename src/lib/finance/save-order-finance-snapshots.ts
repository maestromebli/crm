import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeDealFinanceRollup } from "./deal-finance-rollup";
import { logDealFinanceActivity } from "./log-deal-finance-activity";

function marginPct(
  revenue: Prisma.Decimal,
  cost: Prisma.Decimal,
): Prisma.Decimal | null {
  if (!revenue.gt(0)) return null;
  return revenue.minus(cost).div(revenue).mul(100).toDecimalPlaces(4);
}

export async function saveOrderFinancialSnapshotsByDeal(args: {
  dealId: string;
  source?: string;
  actorUserId?: string | null;
  comment?: string;
  meta?: Prisma.InputJsonValue;
}): Promise<{ snapshotCount: number; orderIds: string[] }> {
  const [rollup, dealProfile, orders] = await Promise.all([
    computeDealFinanceRollup(args.dealId),
    prisma.dealFinanceProfile.findUnique({
      where: { dealId: args.dealId },
      select: { contractAmount: true, approvedPrice: true, expectedCost: true },
    }),
    prisma.order.findMany({
      where: { dealId: args.dealId },
      select: { id: true, amount: true },
    }),
  ]);

  if (orders.length === 0) {
    return { snapshotCount: 0, orderIds: [] };
  }

  const fallbackPlannedRevenue = rollup.revenueUah;
  const plannedCostFallback =
    dealProfile?.expectedCost != null
      ? dealProfile.expectedCost
      : rollup.expensesUah;

  const rows = orders.map((order) => {
    const orderAmount =
      order.amount != null ? new Prisma.Decimal(order.amount) : null;
    const plannedRevenue =
      orderAmount ??
      dealProfile?.approvedPrice ??
      dealProfile?.contractAmount ??
      fallbackPlannedRevenue;
    const actualRevenue = rollup.paidClientUah;
    const plannedCost = plannedCostFallback;
    const actualCost = rollup.expensesUah;
    return {
      orderId: order.id,
      dealId: args.dealId,
      plannedRevenue,
      actualRevenue,
      plannedCost,
      actualCost,
      plannedMargin: marginPct(plannedRevenue, plannedCost),
      actualMargin: marginPct(actualRevenue, actualCost),
      source: args.source ?? "deal_rollup",
      comment: args.comment ?? null,
      metaJson:
        args.meta ??
        ({
          rollupRevenueUah: rollup.revenueUah.toString(),
          rollupPaidClientUah: rollup.paidClientUah.toString(),
          rollupExpensesUah: rollup.expensesUah.toString(),
        } as Prisma.InputJsonValue),
    };
  });

  // NOTE: schema changes may exist before prisma client regeneration in local dev.
  const orderFinancialSnapshotModel = (prisma as any).orderFinancialSnapshot as {
    create(args: {
      data: (typeof rows)[number];
      select: { id: true };
    }): Prisma.PrismaPromise<{ id: string }>;
  };

  await prisma.$transaction(
    rows.map((row) =>
      orderFinancialSnapshotModel.create({
        data: row,
        select: { id: true },
      }),
    ),
  );

  if (args.actorUserId) {
    await logDealFinanceActivity({
      dealId: args.dealId,
      actorUserId: args.actorUserId,
      type: "DEAL_FINANCE_SNAPSHOT_SAVED",
      data: {
        source: args.source ?? "deal_rollup",
        orderSnapshotCount: rows.length,
      },
    });
  }

  return { snapshotCount: rows.length, orderIds: rows.map((x) => x.orderId) };
}
