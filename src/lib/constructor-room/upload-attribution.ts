import type { PrismaClient } from "@prisma/client";

/** Для запису Attachment від імені компанії: керівник виробництва або власник угоди. */
export async function resolveDealUploaderUserId(
  prisma: PrismaClient,
  dealId: string,
): Promise<string> {
  const d = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { ownerId: true, productionManagerId: true },
  });
  if (!d) throw new Error("DEAL_NOT_FOUND");
  return d.productionManagerId ?? d.ownerId;
}
