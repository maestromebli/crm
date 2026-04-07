import type { EstimateCategoryKey } from "./estimate-categories";
import { parseCategoryKey } from "./estimate-categories";
import type { SnapshotLine } from "./estimate-version-diff";

type Meta = {
  supplierProvider?: string;
  supplierMaterialName?: string;
};

function parseMeta(raw: unknown): Meta {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    supplierProvider:
      typeof o.supplierProvider === "string" ? o.supplierProvider : undefined,
    supplierMaterialName:
      typeof o.supplierMaterialName === "string"
        ? o.supplierMaterialName
        : undefined,
  };
}

export function apiLineToSnapshotLine(li: {
  id: string;
  category: string | null;
  productName: string;
  qty: number;
  unit: string;
  salePrice: number;
  amountSale: number;
  metadataJson?: unknown;
}): SnapshotLine {
  const m = parseMeta(li.metadataJson);
  return {
    key: li.id,
    categoryKey: parseCategoryKey(li.category),
    productName: li.productName,
    qty: li.qty,
    unit: li.unit,
    salePrice: li.salePrice,
    amountSale: li.amountSale,
    supplierProvider: m.supplierProvider ?? null,
    supplierMaterialName: m.supplierMaterialName ?? null,
  };
}

export function draftLikeToSnapshotLine(row: {
  key: string;
  categoryKey: EstimateCategoryKey;
  productName: string;
  qty: string;
  coefficient?: string | null;
  unit: string;
  salePrice: string;
  supplierProvider?: string | null;
  supplierMaterialName?: string | null;
}): SnapshotLine {
  const qty = Number(String(row.qty).replace(",", ".")) || 0;
  const coeff =
    Number(String(row.coefficient ?? "1").replace(",", ".")) || 1;
  const salePrice = Number(String(row.salePrice).replace(",", ".")) || 0;
  return {
    key: row.key,
    categoryKey: row.categoryKey,
    productName: row.productName.trim(),
    qty,
    unit: row.unit.trim() || "шт",
    salePrice,
    amountSale: qty * coeff * salePrice,
    supplierProvider: row.supplierProvider ?? null,
    supplierMaterialName: row.supplierMaterialName ?? null,
  };
}
