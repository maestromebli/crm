import type { EstimateLineType, Prisma } from "@prisma/client";
import { newEstimateStableLineId } from "./new-stable-line-id";
import { recalculateEstimateTotals } from "./recalculate";

/** Рядок смети для нової версії (immutable fork). */
export type EstimateLineInput = {
  type: EstimateLineType;
  category: string | null;
  productName: string;
  qty: number;
  unit: string;
  salePrice: number;
  costPrice: number | null;
  amountSale: number;
  amountCost: number | null;
  margin: number | null;
  metadataJson?: unknown;
  /** Копіюється з попередньої версії для дифів; якщо немає — генерується в БД. */
  stableLineId?: string;
  sectionId?: string | null;
  sortOrder?: number;
  code?: string | null;
  supplierRef?: string | null;
  notes?: string | null;
};

/**
 * Створює НОВУ версію смети по ліду з повним набором рядків.
 * Попередні версії зі статусом DRAFT/SENT/APPROVED отримують SUPERSEDED (архів).
 * Нова смета стає поточною для ліда (activeEstimateId).
 *
 * Попередній запис estimate не змінює рядків — лише залишається в БД як архівна версія.
 */
export async function forkLeadEstimateWithNewLines(
  tx: Prisma.TransactionClient,
  args: {
    leadId: string;
    baseEstimateId: string;
    newLines: EstimateLineInput[];
    name?: string | null;
    notes: string | null;
    discountAmount: number;
    deliveryCost: number;
    installationCost: number;
    changeSummary: string | null;
    createdById: string;
  },
) {
  const base = await tx.estimate.findFirst({
    where: { id: args.baseEstimateId, leadId: args.leadId },
    select: { id: true, templateKey: true },
  });
  if (!base) {
    throw new Error("BASE_ESTIMATE_NOT_FOUND");
  }

  const last = await tx.estimate.findFirst({
    where: { leadId: args.leadId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (last?.version ?? 0) + 1;

  const linesForCalc = args.newLines.map((l) => ({
    amountSale: l.amountSale,
    amountCost: l.amountCost,
    metadataJson: l.metadataJson,
  }));
  const totals = recalculateEstimateTotals(
    linesForCalc,
    args.discountAmount,
    args.deliveryCost,
    args.installationCost,
  );

  const created = await tx.estimate.create({
    data: {
      leadId: args.leadId,
      dealId: null,
      ...(args.name !== undefined ? { name: args.name } : {}),
      version: nextVersion,
      status: "DRAFT",
      templateKey: base.templateKey,
      notes: args.notes,
      changeSummary: args.changeSummary,
      discountAmount: args.discountAmount,
      deliveryCost: args.deliveryCost,
      installationCost: args.installationCost,
      totalPrice: totals.totalPrice,
      totalCost: totals.totalCost,
      grossMargin: totals.grossMargin,
      createdById: args.createdById,
      lineItems: {
        create: args.newLines.map((l, idx) => ({
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
          sortOrder: l.sortOrder ?? idx,
          stableLineId: l.stableLineId?.trim() || newEstimateStableLineId(),
          ...(l.code != null ? { code: l.code } : {}),
          ...(l.supplierRef != null ? { supplierRef: l.supplierRef } : {}),
          ...(l.notes != null ? { notes: l.notes } : {}),
          ...(l.metadataJson !== undefined && l.metadataJson !== null
            ? { metadataJson: l.metadataJson as object }
            : {}),
        })),
      },
    },
    include: {
      lineItems: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
    },
  });

  await tx.estimate.updateMany({
    where: {
      leadId: args.leadId,
      id: { not: created.id },
      status: { in: ["DRAFT", "SENT", "APPROVED"] },
    },
    data: { status: "SUPERSEDED", isActive: false },
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
