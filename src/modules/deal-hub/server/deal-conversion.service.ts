import { prisma } from "@/lib/prisma";

export async function buildDealConversionSummary(dealId: string) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      id: true,
      leadId: true,
      createdAt: true,
      lead: {
        select: {
          id: true,
          title: true,
          convertedDeal: { select: { id: true } },
        },
      },
    },
  });
  if (!deal) return null;
  return {
    dealId: deal.id,
    leadId: deal.leadId,
    createdAt: deal.createdAt.toISOString(),
    isConvertedFromLead: Boolean(deal.leadId),
    conversionIntegrityOk: deal.lead ? deal.lead.convertedDeal?.id === deal.id : true,
  };
}
