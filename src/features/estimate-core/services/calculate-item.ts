import type {
  EstimateCoreComputedItem,
  EstimateCoreItemInput,
} from "../types";

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// CORE LOGIC - DO NOT BREAK
export function calculateItem(item: EstimateCoreItemInput): EstimateCoreComputedItem {
  const lineCost = roundMoney(item.quantity * item.unitCost);
  const lineRevenue = roundMoney(item.quantity * item.unitPrice);
  const lineMargin = roundMoney(lineRevenue - lineCost);
  const lineMarginPercent =
    lineRevenue > 0 ? roundMoney((lineMargin / lineRevenue) * 100) : 0;
  const warnings: string[] = [];

  if (item.unitPrice < item.unitCost) warnings.push("Negative margin");
  if (item.quantity <= 0) warnings.push("Quantity must be positive");
  if (lineMarginPercent < 12) warnings.push("Low margin safety");

  return {
    ...item,
    lineCost,
    lineRevenue,
    lineMargin,
    lineMarginPercent,
    warnings,
  };
}
