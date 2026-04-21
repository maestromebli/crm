import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { moneyFromDb } from "@/lib/finance/money";
import {
  parseDealCommercialSnapshot,
  totalFromProposalSnapshotJson,
} from "../deals/commercial-snapshot";

export type DealFinanceRollup = {
  dealId: string;
  revenueUah: Prisma.Decimal;
  expensesUah: Prisma.Decimal;
  paidClientUah: Prisma.Decimal;
  profitUah: Prisma.Decimal;
  marginPct: Prisma.Decimal | null;
};

function toDecimal(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n.toFixed(2));
}

/**
 * Агрегат по замовленні: виручка з КП / value, витрати та надходження з `MoneyTransaction`.
 */
export async function computeDealFinanceRollup(dealId: string): Promise<DealFinanceRollup> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      id: true,
      value: true,
      commercialSnapshotJson: true,
    },
  });
  if (!deal) {
    throw new Error(`Deal not found: ${dealId}`);
  }

  const snap = parseDealCommercialSnapshot(deal.commercialSnapshotJson);
  const fromProposal =
    snap != null ? totalFromProposalSnapshotJson(snap.snapshotJson) : null;
  const revenueNum = fromProposal ?? moneyFromDb(deal.value);
  const revenueUah = toDecimal(revenueNum);

  const [expenseAgg, paidAgg] = await Promise.all([
    prisma.moneyTransaction.aggregate({
      where: { dealId, type: "EXPENSE" },
      _sum: { amount: true },
    }),
    prisma.moneyTransaction.aggregate({
      where: { dealId, type: "INCOME", status: "PAID" },
      _sum: { amount: true },
    }),
  ]);

  const expensesUah = expenseAgg._sum.amount ?? new Prisma.Decimal(0);
  const paidClientUah = paidAgg._sum.amount ?? new Prisma.Decimal(0);

  const profitUah = revenueUah.minus(expensesUah);
  const marginPct =
    revenueUah.gt(0)
      ? profitUah.div(revenueUah).mul(100).toDecimalPlaces(4)
      : null;

  return {
    dealId,
    revenueUah,
    expensesUah,
    paidClientUah,
    profitUah,
    marginPct,
  };
}
