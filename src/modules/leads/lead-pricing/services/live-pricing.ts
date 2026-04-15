import { calculateEstimateTotalsFromLines } from "@/features/estimate-core";
import type {
  FurnitureBlockKind,
  FurnitureTemplateKey,
} from "@/lib/estimates/kitchen-cost-sheet-template";
import type { EstimateLineDraft } from "../estimate-line-draft";

type LivePricingTotalsInput = {
  estimate: { totalPrice: number | null; totalCost: number | null } | null;
  lines: EstimateLineDraft[];
  activeTemplateKey: FurnitureTemplateKey;
  discountAmount: number;
  deliveryCost: number;
  installationCost: number;
  metadataJsonForSave: (
    line: EstimateLineDraft,
    templateKey: FurnitureTemplateKey,
  ) => object | null | undefined;
};

export function buildLivePricingTotals(input: LivePricingTotalsInput): {
  totalPrice: number | null;
  totalCost: number | null;
  grossMargin?: number;
} {
  const {
    estimate,
    lines,
    activeTemplateKey,
    discountAmount,
    deliveryCost,
    installationCost,
    metadataJsonForSave,
  } = input;
  if (!estimate) {
    return {
      totalPrice: null,
      totalCost: null,
    };
  }
  if (lines.length === 0) {
    return {
      totalPrice: estimate.totalPrice,
      totalCost: estimate.totalCost,
    };
  }
  const lineLikes = lines.map((li) => ({
    amountSale: li.amountSale,
    amountCost: li.amountCost ?? null,
    metadataJson: metadataJsonForSave(li, activeTemplateKey),
  }));
  return calculateEstimateTotalsFromLines(
    lineLikes,
    discountAmount,
    deliveryCost,
    installationCost,
  );
}

export function buildLiveLineStats(
  lines: EstimateLineDraft[],
  estimateLineTablePartitions: Array<{
    blockKind: FurnitureBlockKind | null;
    lines: EstimateLineDraft[];
  }>,
) {
  const total = lines.length;
  const named = lines.filter((l) => l.productName.trim()).length;
  const priced = lines.filter(
    (l) => l.productName.trim() && (l.salePrice ?? 0) > 0,
  ).length;
  const tables = estimateLineTablePartitions.filter(
    (p) => p.lines.length > 0,
  ).length;
  return { total, named, priced, tables };
}
