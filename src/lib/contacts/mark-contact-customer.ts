import { prisma } from "../prisma";
import { updateContactLifecycleToCustomerRaw } from "./contact-lifecycle-raw";

/**
 * Після повного підписання договору — контакт вважається клієнтом (затверджена угода).
 * Повертає `primaryContactId` для revalidate, якщо він є.
 */
export async function markPrimaryContactCustomerOnContractFullySigned(
  dealId: string,
): Promise<string | null> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { primaryContactId: true },
  });
  if (!deal?.primaryContactId) return null;

  await updateContactLifecycleToCustomerRaw(prisma, deal.primaryContactId);

  return deal.primaryContactId;
}
