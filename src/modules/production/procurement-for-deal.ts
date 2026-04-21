import type { PrismaClient } from "@prisma/client";

export type ProcurementGateSummary = {
  projectCount: number;
  openMaterialLines: number;
  openRequests: number;
};

/**
 * Закупівлі по замовленні: без окремих таблиць у схемі повертаємо нульові лічильники;
 * деталі — через `ProductionFlow` / майбутні PO.
 */
export async function getProcurementSummaryForDeal(
  _prisma: PrismaClient,
  _dealId: string,
): Promise<ProcurementGateSummary> {
  return {
    projectCount: 0,
    openMaterialLines: 0,
    openRequests: 0,
  };
}
