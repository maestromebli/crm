import type { Prisma } from "@prisma/client";
import { calculateEstimateTotalsFromLines } from "@/features/estimate-core";
import { newEstimateStableLineId } from "./new-stable-line-id";
import type { DraftLine } from "./ai-estimate-draft";

export async function createDealEstimateFromDraft(
  tx: Prisma.TransactionClient,
  args: {
    dealId: string;
    userId: string;
    draftLines: DraftLine[];
    changeSummary: string;
    notes: string | null;
  },
) {
  const lineData = args.draftLines.map((l) => ({
    type: l.type,
    category: l.category,
    productName: l.productName,
    qty: l.qty,
    unit: l.unit,
    salePrice: l.salePrice,
    costPrice: null as number | null,
    amountSale: l.amountSale,
    amountCost: null as number | null,
    margin: null as number | null,
  }));

  const last = await tx.estimate.findFirst({
    where: { dealId: args.dealId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (last?.version ?? 0) + 1;

  const discountAmount = 0;
  const deliveryCost = 0;
  const installationCost = 0;
  const totals = calculateEstimateTotalsFromLines(
    lineData.map((l) => ({
      amountSale: l.amountSale,
      amountCost: l.amountCost,
    })),
    discountAmount,
    deliveryCost,
    installationCost,
  );

  return tx.estimate.create({
    data: {
      dealId: args.dealId,
      leadId: null,
      version,
      status: "DRAFT",
      notes: args.notes,
      changeSummary: args.changeSummary,
      discountAmount,
      deliveryCost,
      installationCost,
      totalPrice: totals.totalPrice,
      totalCost: totals.totalCost,
      grossMargin: totals.grossMargin,
      createdById: args.userId,
      lineItems: {
        create: lineData.map((l, idx) => ({
          ...l,
          stableLineId: newEstimateStableLineId(),
          sortOrder: idx,
        })),
      },
    },
    include: { lineItems: true },
  });
}
