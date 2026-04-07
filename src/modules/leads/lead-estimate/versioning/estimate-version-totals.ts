export function recalcTotals(
  lineSum: number,
  discountAmount: number,
  deliveryCost: number,
  installationCost: number,
) {
  const total = lineSum - discountAmount + deliveryCost + installationCost;
  return { subtotal: lineSum, total };
}

export function discountPercent(
  subtotal: number,
  discountAmount: number,
): number | null {
  if (subtotal <= 0) return null;
  return Math.round((discountAmount / subtotal) * 1000) / 10;
}

export function marginPercent(total: number, grossMargin: number | null) {
  if (grossMargin == null || total <= 0) return null;
  return Math.round((grossMargin / total) * 1000) / 10;
}
