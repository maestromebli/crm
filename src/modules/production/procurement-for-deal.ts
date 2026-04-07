import type { PrismaClient } from "@prisma/client";

export type ProcurementGateSummary = {
  projectCount: number;
  openMaterialLines: number;
  openRequests: number;
};

const TERMINAL_PO = new Set(["DELIVERED", "CANCELED"]);

/**
 * Закупівлі по угоді: `DealPurchaseOrder` замість legacy Project/Request.
 */
export async function getProcurementSummaryForDeal(
  prisma: PrismaClient,
  dealId: string,
): Promise<ProcurementGateSummary> {
  const projects = await prisma.project.findMany({
    where: { dealId },
    select: { id: true },
  });

  const orders = await prisma.dealPurchaseOrder.findMany({
    where: { dealId },
    select: { status: true },
  });

  const openMaterialLines = orders.filter(
    (o) => !TERMINAL_PO.has(o.status),
  ).length;

  return {
    projectCount: projects.length,
    openMaterialLines,
    openRequests: openMaterialLines,
  };
}
