import type { EstimateLineItem } from "@prisma/client";

type LineLike = Pick<
  EstimateLineItem,
  "amountSale" | "amountCost"
>;

export function recalculateEstimateTotals(
  lineItems: LineLike[],
  discountAmount: number | null | undefined,
  deliveryCost: number | null | undefined,
  installationCost: number | null | undefined,
): { totalPrice: number; totalCost: number; grossMargin: number } {
  const sumSale = lineItems.reduce((a, l) => a + l.amountSale, 0);
  const sumCost = lineItems.reduce(
    (a, l) => a + (l.amountCost ?? 0),
    0,
  );
  const disc = discountAmount ?? 0;
  const del = deliveryCost ?? 0;
  const inst = installationCost ?? 0;
  const totalPrice = sumSale - disc + del + inst;
  const totalCost = sumCost;
  const grossMargin = totalPrice - totalCost;
  return { totalPrice, totalCost, grossMargin };
}
