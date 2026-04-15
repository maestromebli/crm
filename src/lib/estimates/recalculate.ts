import type { EstimateLineItem } from "@prisma/client";

type LineLike = Pick<
  EstimateLineItem,
  "amountSale" | "amountCost"
>;

/**
 * @deprecated Use `calculateEstimateTotalsFromLines` from `features/estimate-core`.
 */
export function recalculateEstimateTotals(
  lineItems: LineLike[],
  discountAmount: number | null | undefined,
  deliveryCost: number | null | undefined,
  installationCost: number | null | undefined,
): { totalPrice: number; totalCost: number; grossMargin: number } {
  // CORE LOGIC - DO NOT BREAK
  const safe = (n: number | null | undefined): number =>
    typeof n === "number" && Number.isFinite(n) ? n : 0;
  const round2 = (n: number): number => Math.round(n * 100) / 100;
  const sumSale = lineItems.reduce((a, l) => a + safe(l.amountSale), 0);
  const sumCost = lineItems.reduce(
    (a, l) => a + safe(l.amountCost),
    0,
  );
  const disc = Math.max(0, safe(discountAmount));
  const del = Math.max(0, safe(deliveryCost));
  const inst = Math.max(0, safe(installationCost));
  const totalPrice = round2(sumSale - disc + del + inst);
  const totalCost = round2(sumCost);
  const grossMargin = round2(totalPrice - totalCost);
  return { totalPrice, totalCost, grossMargin };
}
