import type { SupplierItem } from "../core/supplierTypes";
import { getSupplierItemById, getSupplierItemsByIds } from "./supplierSearchService";

export type SupplierPriceDelta = {
  id: string;
  previousPrice: number;
  currentPrice: number;
  changed: boolean;
  updatedAt: string;
};

export async function getSupplierPrice(itemId: string): Promise<SupplierItem | null> {
  return getSupplierItemById(itemId);
}

export async function getSupplierPrices(itemIds: string[]): Promise<SupplierItem[]> {
  return getSupplierItemsByIds(itemIds);
}

export function detectSupplierPriceChange(args: {
  previousPrice: number | null | undefined;
  currentPrice: number | null | undefined;
  updatedAt: string;
  id: string;
}): SupplierPriceDelta {
  const prev = Number(args.previousPrice ?? 0);
  const curr = Number(args.currentPrice ?? 0);
  const changed = Math.abs(prev - curr) > 0.009;
  return {
    id: args.id,
    previousPrice: prev,
    currentPrice: curr,
    changed,
    updatedAt: args.updatedAt,
  };
}
