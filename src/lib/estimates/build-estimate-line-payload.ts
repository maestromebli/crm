import type { EstimateLineType } from "@prisma/client";
import {
  encodeCategoryKey,
  lineTypeForCategory,
  type EstimateCategoryKey,
} from "./estimate-categories";

export type DraftLineLike = {
  categoryKey: EstimateCategoryKey;
  productName: string;
  qty: string;
  /** Множник (за замовчуванням 1); total = qty × coefficient × unitPrice */
  coefficient?: string | null;
  unit: string;
  salePrice: string;
  supplierProvider?: string | null;
  supplierMaterialId?: string | null;
  supplierMaterialName?: string | null;
  supplierPriceSnapshot?: number | null;
  /** Id рядка базової версії (lineage для diff) */
  baseItemId?: string | null;
  /** manual | supplier_snapshot */
  unitPriceSource?: "manual" | "supplier_snapshot" | null;
};

function num(s: string) {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Рядки чернетки → payload для PATCH / fork (ідентично робочому простору смети).
 */
export function buildEstimateLinePayload(
  rows: DraftLineLike[],
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    const name = row.productName.trim();
    if (!name) continue;
    const qty = num(row.qty);
    const coeff = num(row.coefficient ?? "1") || 1;
    const salePrice = num(row.salePrice);
    const unit = row.unit.trim() || "шт";
    const amountSale = qty * coeff * salePrice;
    const type: EstimateLineType = lineTypeForCategory(row.categoryKey);
    const meta: Record<string, unknown> = {};
    if (coeff !== 1) meta.coefficient = String(coeff);
    if (row.supplierProvider?.trim())
      meta.supplierProvider = row.supplierProvider.trim();
    if (row.supplierMaterialId?.trim())
      meta.supplierMaterialId = row.supplierMaterialId.trim();
    if (row.supplierMaterialName?.trim())
      meta.supplierMaterialName = row.supplierMaterialName.trim();
    if (
      row.supplierPriceSnapshot != null &&
      Number.isFinite(row.supplierPriceSnapshot)
    ) {
      meta.supplierPriceSnapshot = row.supplierPriceSnapshot;
    }
    if (row.baseItemId?.trim()) meta.baseItemId = row.baseItemId.trim();
    if (row.unitPriceSource === "manual" || row.unitPriceSource === "supplier_snapshot") {
      meta.unitPriceSource = row.unitPriceSource;
    }
    out.push({
      type,
      category: encodeCategoryKey(row.categoryKey),
      productName: name,
      qty,
      unit,
      salePrice,
      costPrice: null,
      amountSale,
      amountCost: null,
      margin: null,
      ...(Object.keys(meta).length > 0 ? { metadataJson: meta } : {}),
    });
  }
  return out;
}
