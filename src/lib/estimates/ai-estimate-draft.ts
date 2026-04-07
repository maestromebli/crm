/**
 * Чернетка смети з вільного тексту без зовнішнього API (евристики + ключові слова).
 * Для OpenAI — розширити окремим викликом за наявності ключа.
 */
import type { EstimateLineType } from "@prisma/client";

import type { EstimateCategoryKey } from "./estimate-categories";

export type DraftLine = {
  type: EstimateLineType;
  category: string | null;
  categoryKey?: EstimateCategoryKey;
  productName: string;
  qty: number;
  unit: string;
  salePrice: number;
  amountSale: number;
};

export type AiEstimateDraftResult = {
  lines: DraftLine[];
  assumptions: string[];
  missing: string[];
};

const KW = {
  kitchen: ["кухн", "кут", "кухні"],
  wardrobe: ["шаф", "гардероб", "купе"],
  delivery: ["доставк"],
  install: ["монтаж", "установк", "збірк"],
};

function detectCategory(text: string): string | null {
  const t = text.toLowerCase();
  for (const k of KW.kitchen) if (t.includes(k)) return "Кухня";
  for (const k of KW.wardrobe) if (t.includes(k)) return "Шафа / гардероб";
  return null;
}

export function parseEstimatePromptToDraft(text: string): AiEstimateDraftResult {
  const raw = text.trim();
  const assumptions: string[] = [];
  const missing: string[] = [];
  if (!raw) {
    missing.push("порожній запит");
    return { lines: [], assumptions, missing };
  }

  const cat = detectCategory(raw);
  if (cat) assumptions.push(`Тип проєкту: ${cat}`);

  const lines: DraftLine[] = [];

  const dimM = raw.match(/(\d+[.,]\d+|\d+)\s*(м|м\.|m)\b/i);
  const dimMm = raw.match(/(\d+)\s*(мм|mm)/i);
  if (dimM) {
    assumptions.push(`Згадана довжина / розмір: ${dimM[0]}`);
  }
  if (dimMm) {
    assumptions.push(`Згадана товщина / розмір: ${dimMm[0]}`);
  }

  const brands = [
    "Egger",
    "Blum",
    "Hettich",
    "Muller",
    "Kronospan",
    "Фасад",
    "ДСП",
    "МДФ",
  ];
  const foundBrands = brands.filter((b) =>
    raw.toLowerCase().includes(b.toLowerCase()),
  );
  if (foundBrands.length) {
    assumptions.push(`Матеріали / бренди: ${foundBrands.join(", ")}`);
  }

  const baseName =
    raw.length > 120 ? `${raw.slice(0, 117)}…` : raw;
  lines.push({
    type: "PRODUCT",
    category: cat,
    productName: baseName || "Позиція з тексту запиту",
    qty: 1,
    unit: "компл",
    salePrice: 0,
    amountSale: 0,
  });

  if (!/достав|монтаж/i.test(raw)) {
    missing.push("доставка / монтаж (за потреби додайте вручну)");
  }
  if (!/фурн|фурнітур|Blum|Hettich/i.test(raw)) {
    missing.push("фурнітура (уточніть уточнення)");
  }

  return { lines, assumptions, missing };
}
