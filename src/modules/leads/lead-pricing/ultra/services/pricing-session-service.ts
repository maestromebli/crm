import { prisma } from "@/lib/prisma";
import { calculatePricing } from "../engine/calculate-pricing";
import { mapDbPricingItemToInput } from "../adapters/pricing-mapper";

export async function recalculatePricingSession(pricingSessionId: string) {
  const pricingSession = await prisma.pricingSession.findUnique({
    where: { id: pricingSessionId },
    include: {
      activeVersion: {
        include: {
          items: true,
        },
      },
    },
  });

  if (!pricingSession) throw new Error("Pricing session not found");
  if (!pricingSession.activeVersion) return null;

  const inputs = pricingSession.activeVersion.items.map(mapDbPricingItemToInput);
  const calculated = calculatePricing(inputs);
  const nextVersionNumber = pricingSession.activeVersion.versionNumber + 1;

  const createdVersion = await prisma.pricingVersion.create({
    data: {
      pricingSessionId,
      versionNumber: nextVersionNumber,
      totalsJson: calculated.totals,
      summaryJson: calculated.summary,
      items: {
        create: calculated.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          inputJson: {
            unitCost: item.unitCost,
            unitPrice: item.unitPrice,
            category: item.category ?? null,
            note: item.note ?? null,
          },
          resultJson: {
            lineCost: item.lineCost,
            lineRevenue: item.lineRevenue,
            lineMargin: item.lineMargin,
            lineMarginPercent: item.lineMarginPercent,
            warnings: item.warnings,
          },
        })),
      },
    },
    include: { items: true },
  });

  await prisma.pricingSession.update({
    where: { id: pricingSessionId },
    data: { activeVersionId: createdVersion.id },
  });

  return createdVersion;
}
