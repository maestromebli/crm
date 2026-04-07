/**
 * Підсумки кухонного/меблевого листа, коли в одній сметі кілька таблиць (типів блоків).
 * «Підсумкова вартість» у кожній таблиці рахується з округленням — верхні KPI мають
 * збігатися з сумою нижніх підсумків, тому сумуємо по партиціях (furnitureBlockKind).
 */
import {
  KITCHEN_CLIENT_PRICE_MULTIPLIER,
  sumMaterialRowsFromKitchenLines,
} from "./kitchen-cost-sheet-template";

export function furnitureBlockKeyFromMetadata(
  metadataJson: unknown,
): string {
  if (!metadataJson || typeof metadataJson !== "object") return "__none__";
  const fk = (metadataJson as { furnitureBlockKind?: unknown })
    .furnitureBlockKind;
  return typeof fk === "string" && fk.trim() ? fk.trim() : "__none__";
}

export function partitionLineItemsByFurnitureBlockKind<
  T extends { metadataJson?: unknown },
>(lines: T[]): T[][] {
  const buckets = new Map<string, T[]>();
  for (const l of lines) {
    const k = furnitureBlockKeyFromMetadata(l.metadataJson);
    const arr = buckets.get(k) ?? [];
    arr.push(l);
    buckets.set(k, arr);
  }
  return Array.from(buckets.values());
}

/** Сума «Підсумкова ВАРТІСТЬ по замовленню» по всіх таблицях (як у UI). */
export function kitchenClientTotalPartitionedRounded(
  lines: Array<{ amountSale: number; metadataJson?: unknown }>,
): number {
  const parts = partitionLineItemsByFurnitureBlockKind(lines);
  let sum = 0;
  for (const part of parts) {
    const { material, measurement } = sumMaterialRowsFromKitchenLines(part);
    sum +=
      Math.round(material * KITCHEN_CLIENT_PRICE_MULTIPLIER * 100) / 100 +
      measurement;
  }
  return sum;
}

/** Собівартість (сума матеріалів + вимірювань) — узгоджена з партиціями. */
export function kitchenCostTotalPartitioned(
  lines: Array<{ amountSale: number; metadataJson?: unknown }>,
): number {
  const parts = partitionLineItemsByFurnitureBlockKind(lines);
  let sum = 0;
  for (const part of parts) {
    const { material, measurement } = sumMaterialRowsFromKitchenLines(part);
    sum += material + measurement;
  }
  return sum;
}
