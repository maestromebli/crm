import { recalculateEstimateTotals } from "@/lib/estimates/recalculate";

type EstimateLineLike = {
  amountSale: number | null;
  amountCost: number | null;
};

export function calculateEstimateTotalsFromLines(
  lineItems: EstimateLineLike[],
  discountAmount: number | null | undefined,
  deliveryCost: number | null | undefined,
  installationCost: number | null | undefined,
): { totalPrice: number; totalCost: number; grossMargin: number } {
  return recalculateEstimateTotals(
    lineItems,
    discountAmount,
    deliveryCost,
    installationCost,
  );
}
