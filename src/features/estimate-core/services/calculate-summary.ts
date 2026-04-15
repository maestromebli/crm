import { calculateMargin } from "./calculate-margin";
import type {
  EstimateCoreComputedItem,
  EstimateCoreSummary,
} from "../types";

// CORE LOGIC - DO NOT BREAK
export function calculateSummary(
  computedItems: EstimateCoreComputedItem[],
): EstimateCoreSummary {
  const warningCount = computedItems.reduce(
    (acc, item) => acc + item.warnings.length,
    0,
  );
  const topRiskItems = computedItems
    .filter((item) => item.warnings.length > 0)
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      name: item.name,
      reason: item.warnings[0] ?? "Manual review required",
    }));

  const totalCost = computedItems.reduce((acc, item) => acc + item.lineCost, 0);
  const totalRevenue = computedItems.reduce(
    (acc, item) => acc + item.lineRevenue,
    0,
  );
  const margin = calculateMargin(totalRevenue, totalCost);

  return {
    itemCount: computedItems.length,
    warningCount,
    topRiskItems,
    totalCost,
    totalRevenue,
    ...margin,
  };
}
