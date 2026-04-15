import { calculateLeadPricing, calculateLeadPricingItem } from "@/features/estimate-core";
import { calculateSummary } from "@/features/estimate-core";
import type {
  PricingCalculationResult,
  PricingComputedItem,
  PricingItemInput,
} from "./types";

/**
 * @deprecated DUPLICATE PRICING - TO BE REFACTORED
 * Use `calculateItem` from `features/estimate-core`.
 */
export function calculatePricingItem(item: PricingItemInput): PricingComputedItem {
  return calculateLeadPricingItem(item);
}

/**
 * @deprecated DUPLICATE PRICING - TO BE REFACTORED
 * Use `calculateSummary` from `features/estimate-core`.
 */
export function buildPricingSummary(
  computedItems: PricingComputedItem[],
): PricingCalculationResult["summary"] {
  const summary = calculateSummary(computedItems);
  return {
    itemCount: summary.itemCount,
    warningCount: summary.warningCount,
    topRiskItems: summary.topRiskItems,
  };
}

/**
 * @deprecated DUPLICATE PRICING - TO BE REFACTORED
 * Use `calculateSummary` from `features/estimate-core`.
 */
export function buildPricingTotals(
  computedItems: PricingComputedItem[],
): PricingCalculationResult["totals"] {
  const summary = calculateSummary(computedItems);
  return {
    totalCost: summary.totalCost,
    totalRevenue: summary.totalRevenue,
    grossProfit: summary.grossProfit,
    marginPercent: summary.marginPercent,
    riskLevel: summary.riskLevel,
  };
}

// CORE LOGIC - DO NOT BREAK
export function calculatePricing(
  items: PricingItemInput[],
): PricingCalculationResult {
  return calculateLeadPricing(items);
}
