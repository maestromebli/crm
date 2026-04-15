import type { PricingItemInput } from "../engine/types";

type RawPricingItem = {
  id: string;
  name: string;
  quantity: number;
  inputJson: unknown;
};

export function mapDbPricingItemToInput(item: RawPricingItem): PricingItemInput {
  const input = (item.inputJson ?? {}) as {
    unitCost?: number;
    unitPrice?: number;
    category?: string;
    note?: string;
  };

  return {
    id: item.id,
    name: item.name,
    quantity: Number(item.quantity ?? 0),
    unitCost: Number(input.unitCost ?? 0),
    unitPrice: Number(input.unitPrice ?? 0),
    category: input.category,
    note: input.note,
  };
}
