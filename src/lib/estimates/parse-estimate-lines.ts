import type { EstimateLineType } from "@prisma/client";

const LINE_TYPES: EstimateLineType[] = [
  "PRODUCT",
  "SERVICE",
  "DELIVERY",
  "INSTALLATION",
  "DISCOUNT",
  "OTHER",
];

export type EstimatePatchLineInput = {
  type: EstimateLineType;
  category: string | null;
  productName: string;
  qty: number;
  unit: string;
  salePrice: number;
  costPrice: number | null;
  amountSale: number;
  amountCost: number | null;
  margin: number | null;
  metadataJson?: unknown;
};

export function parseEstimatePatchLineItems(input: unknown): {
  lines: EstimatePatchLineInput[] | null;
  error?: string;
} {
  if (!Array.isArray(input)) {
    return { lines: null };
  }

  const lines: EstimatePatchLineInput[] = [];
  for (const raw of input as Record<string, unknown>[]) {
    const type = raw.type as EstimateLineType;
    if (!LINE_TYPES.includes(type)) {
      return { lines: null, error: `Некоректний тип рядка: ${String(raw.type)}` };
    }

    const productName =
      typeof raw.productName === "string" ? raw.productName.trim() : "";
    if (!productName) {
      return { lines: null, error: "Кожен рядок потребує productName" };
    }

    const qty =
      typeof raw.qty === "number" && Number.isFinite(raw.qty) ? raw.qty : 0;
    const unit =
      typeof raw.unit === "string" && raw.unit.trim() ? raw.unit.trim() : "шт";
    const salePrice =
      typeof raw.salePrice === "number" && Number.isFinite(raw.salePrice)
        ? raw.salePrice
        : 0;
    const costPrice =
      raw.costPrice === null || raw.costPrice === undefined
        ? null
        : typeof raw.costPrice === "number" && Number.isFinite(raw.costPrice)
          ? raw.costPrice
          : null;
    const amountSale =
      typeof raw.amountSale === "number" && Number.isFinite(raw.amountSale)
        ? raw.amountSale
        : qty * salePrice;
    const amountCost =
      costPrice === null
        ? null
        : typeof raw.amountCost === "number" && Number.isFinite(raw.amountCost)
          ? raw.amountCost
          : qty * (costPrice ?? 0);
    const margin = amountCost === null ? null : amountSale - amountCost;

    lines.push({
      type,
      category:
        typeof raw.category === "string" ? raw.category.trim() || null : null,
      productName,
      qty,
      unit,
      salePrice,
      costPrice,
      amountSale,
      amountCost,
      margin,
      metadataJson: raw.metadataJson,
    });
  }

  return { lines };
}
