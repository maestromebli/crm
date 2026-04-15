import { calculateItem } from "../services/calculate-item";
import { calculateSummary } from "../services/calculate-summary";
import type { EstimateCoreItemInput } from "../types";
import type {
  PricingCalculationResult,
  PricingComputedItem,
  PricingItemInput,
} from "@/modules/leads/lead-pricing/ultra/engine/types";

function toCoreItem(item: PricingItemInput): EstimateCoreItemInput {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unitCost: item.unitCost,
    unitPrice: item.unitPrice,
    category: item.category,
    note: item.note,
  };
}

export function calculateLeadPricingItem(item: PricingItemInput): PricingComputedItem {
  return calculateItem(toCoreItem(item)) as PricingComputedItem;
}

export function calculateLeadPricing(
  items: PricingItemInput[],
): PricingCalculationResult {
  const computedItems = items.map(calculateLeadPricingItem);
  const summary = calculateSummary(computedItems);
  return {
    items: computedItems,
    totals: {
      totalCost: summary.totalCost,
      totalRevenue: summary.totalRevenue,
      grossProfit: summary.grossProfit,
      marginPercent: summary.marginPercent,
      riskLevel: summary.riskLevel,
    },
    summary: {
      itemCount: summary.itemCount,
      warningCount: summary.warningCount,
      topRiskItems: summary.topRiskItems,
    },
  };
}
