import type { LeadHubPricingItem } from "../domain/types";

function cloneItems(items: LeadHubPricingItem[]): LeadHubPricingItem[] {
  return items.map((item) => ({ ...item }));
}

export async function generateFromImage(
  items: LeadHubPricingItem[],
): Promise<LeadHubPricingItem[]> {
  const next = cloneItems(items);
  next.push({
    id: crypto.randomUUID(),
    name: "AI image detected module",
    quantity: 1,
    unitCost: 1800,
    unitPrice: 2600,
    category: "AI_IMAGE",
  });
  return next;
}

export async function generateFromFile(
  items: LeadHubPricingItem[],
): Promise<LeadHubPricingItem[]> {
  const next = cloneItems(items);
  return next.map((item) => ({
    ...item,
    note: item.note ? `${item.note}; AI enriched` : "AI enriched from file",
  }));
}

export async function optimizePrice(
  items: LeadHubPricingItem[],
): Promise<LeadHubPricingItem[]> {
  return cloneItems(items).map((item) => ({
    ...item,
    unitPrice: Number((item.unitPrice * 1.04).toFixed(2)),
  }));
}

export async function reduceCost(
  items: LeadHubPricingItem[],
): Promise<LeadHubPricingItem[]> {
  return cloneItems(items).map((item) => ({
    ...item,
    unitCost: Number((item.unitCost * 0.95).toFixed(2)),
  }));
}

export async function explainPrice(items: LeadHubPricingItem[]): Promise<string> {
  const total = items.reduce(
    (acc, item) => acc + item.unitPrice * item.quantity,
    0,
  );
  return `Total price forms from ${items.length} lines and equals ${total.toFixed(2)} before tax and logistics modifiers.`;
}

export async function fillMissing(
  items: LeadHubPricingItem[],
): Promise<LeadHubPricingItem[]> {
  return cloneItems(items).map((item) => ({
    ...item,
    unitCost: item.unitCost > 0 ? item.unitCost : 100,
    unitPrice: item.unitPrice > 0 ? item.unitPrice : 150,
  }));
}
