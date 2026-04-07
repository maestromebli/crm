import type { EstimateLineType } from "@prisma/client";

/** Ключі груп для UI (не ERP-категорії). */
export const ESTIMATE_CATEGORY_KEYS = [
  "cabinets",
  "facades",
  "countertop",
  "fittings",
  "delivery",
  "installation",
  "extras",
] as const;

export type EstimateCategoryKey = (typeof ESTIMATE_CATEGORY_KEYS)[number];

export const ESTIMATE_CATEGORY_LABELS: Record<EstimateCategoryKey, string> = {
  cabinets: "Корпус / модулі",
  facades: "Фасади",
  countertop: "Стільниця",
  fittings: "Фурнітура",
  delivery: "Доставка",
  installation: "Монтаж / збірка",
  extras: "Додатково",
};

/** Зберігаємо в `EstimateLineItem.category` як префікс `cat:` + key. */
export const CATEGORY_PREFIX = "cat:";

export function encodeCategoryKey(key: EstimateCategoryKey): string {
  return `${CATEGORY_PREFIX}${key}`;
}

export function parseCategoryKey(
  stored: string | null | undefined,
): EstimateCategoryKey {
  if (!stored?.startsWith(CATEGORY_PREFIX)) return "cabinets";
  const k = stored.slice(CATEGORY_PREFIX.length);
  if (ESTIMATE_CATEGORY_KEYS.includes(k as EstimateCategoryKey)) {
    return k as EstimateCategoryKey;
  }
  return "extras";
}

export function lineTypeForCategory(
  key: EstimateCategoryKey,
): EstimateLineType {
  if (key === "delivery") return "DELIVERY";
  if (key === "installation") return "INSTALLATION";
  return "PRODUCT";
}
