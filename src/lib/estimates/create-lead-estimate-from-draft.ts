import type { EstimateLineType } from "@prisma/client";
import { forkLeadEstimateWithNewLines } from "./fork-lead-estimate";
import type { DraftLine } from "./ai-estimate-draft";
import { recalculateEstimateTotals } from "./recalculate";
import type { Prisma } from "@prisma/client";

function toLineInput(lines: DraftLine[]) {
  return lines.map((l) => ({
    type: l.type as EstimateLineType,
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
}

/**
 * Створює смету з чернетки: перша — create; наступні — fork як нова поточна версія.
 */
export async function createOrForkLeadEstimateFromDraft(
  tx: Prisma.TransactionClient,
  args: {
    leadId: string;
    userId: string;
    draftLines: DraftLine[];
    templateKey: string | null;
    changeSummary: string;
    notes: string | null;
  },
) {
  const lineData = toLineInput(args.draftLines);
  const discountAmount = 0;
  const deliveryCost = 0;
  const installationCost = 0;
  const totals = recalculateEstimateTotals(
    lineData.map((l) => ({
      amountSale: l.amountSale,
      amountCost: l.amountCost,
    })),
    discountAmount,
    deliveryCost,
    installationCost,
  );

  const last = await tx.estimate.findFirst({
    where: { leadId: args.leadId },
    orderBy: { version: "desc" },
    select: { id: true, version: true },
  });

  if (!last) {
    const version = 1;
    const created = await tx.estimate.create({
      data: {
        leadId: args.leadId,
        dealId: null,
        version,
        status: "DRAFT",
        templateKey: args.templateKey ?? undefined,
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
          create: lineData.map((l) => ({
            type: l.type,
            category: l.category,
            productName: l.productName,
            qty: l.qty,
            unit: l.unit,
            salePrice: l.salePrice,
            costPrice: l.costPrice,
            amountSale: l.amountSale,
            amountCost: l.amountCost,
            margin: l.margin,
          })),
        },
      },
      include: {
        lineItems: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
    });

    await tx.lead.update({
      where: { id: args.leadId },
      data: { activeEstimateId: created.id },
    });
    await tx.estimate.update({
      where: { id: created.id },
      data: { isActive: true },
    });

    return created;
  }

  return forkLeadEstimateWithNewLines(tx, {
    leadId: args.leadId,
    baseEstimateId: last.id,
    newLines: lineData,
    notes: args.notes,
    discountAmount,
    deliveryCost,
    installationCost,
    changeSummary: args.changeSummary,
    createdById: args.userId,
  });
}
