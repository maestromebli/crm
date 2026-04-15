import { calculateItem } from "@/features/estimate-core";
import type { LeadHubPricingItem } from "../domain/types";

export function calculatePricingLineMetrics(item: LeadHubPricingItem) {
  // DUPLICATE PRICING - TO BE REFACTORED
  const computed = calculateItem({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unitCost: item.unitCost,
    unitPrice: item.unitPrice,
  });
  return {
    lineCost: computed.lineCost,
    lineRevenue: computed.lineRevenue,
    lineMargin: computed.lineMargin,
    lineMarginPercent: computed.lineMarginPercent,
  };
}
