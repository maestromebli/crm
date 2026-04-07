import { prisma } from "@/lib/prisma";
import { isPrismaMissingTableError } from "@/lib/prisma-errors";

/** Повні рядки віх для workspace (коли таблиці ще немає — порожній масив). */
export async function loadDealPaymentMilestonesForWorkspace(
  dealId: string,
): Promise<Awaited<ReturnType<typeof prisma.dealPaymentMilestone.findMany>>> {
  try {
    return await prisma.dealPaymentMilestone.findMany({
      where: { dealId },
      orderBy: { sortOrder: "asc" },
    });
  } catch (e) {
    if (isPrismaMissingTableError(e)) return [];
    throw e;
  }
}

/** Скорочені поля для сиду договору. */
export async function loadDealPaymentMilestoneSummariesForContract(
  dealId: string,
): Promise<
  Array<{
    label: string | null;
    amount: number | null;
    currency: string | null;
  }>
> {
  try {
    return await prisma.dealPaymentMilestone.findMany({
      where: { dealId },
      orderBy: { sortOrder: "asc" },
      take: 16,
      select: { label: true, amount: true, currency: true },
    });
  } catch (e) {
    if (isPrismaMissingTableError(e)) return [];
    throw e;
  }
}
