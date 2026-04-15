import type { SupplierItem, SupplierKey } from "../core/supplierTypes";

export function providerFromKey(key: string): SupplierKey {
  const upper = key.trim().toUpperCase();
  if (upper === "VIYAR") return "VIYAR";
  if (upper === "MANUAL") return "MANUAL";
  return "CSV";
}

export function mapMaterialCatalogToSupplierItem(row: {
  id: string;
  name: string;
  externalId: string;
  category: string | null;
  unit: string;
  price: number | null;
  currency: string;
  updatedAt: Date;
  brand: string | null;
  displayName: string | null;
  provider: { key: string };
  rawDataJson: unknown;
}): SupplierItem {
  const raw =
    row.rawDataJson && typeof row.rawDataJson === "object"
      ? (row.rawDataJson as Record<string, unknown>)
      : {};
  const parsedName = row.displayName?.trim() || row.name;
  return {
    id: row.id,
    supplier: providerFromKey(row.provider.key),
    name: parsedName,
    code: row.externalId || undefined,
    category: row.category ?? undefined,
    unit: row.unit || "шт",
    price: row.price ?? 0,
    currency: row.currency === "UAH" ? "UAH" : "UAH",
    updatedAt: row.updatedAt.toISOString(),
    metadata: {
      brand: row.brand ?? undefined,
      thickness: typeof raw.thickness === "string" ? raw.thickness : undefined,
      color: typeof raw.color === "string" ? raw.color : undefined,
    },
  };
}
