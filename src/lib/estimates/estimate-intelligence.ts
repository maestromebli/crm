import type { EstimateCategoryKey } from "./estimate-categories";

export type LineLike = {
  categoryKey: EstimateCategoryKey;
  productName: string;
  qty: number;
  salePrice: number;
  amountSale: number;
};

export type EstimateSuggestion = {
  id: string;
  text: string;
  tone: "info" | "warning" | "success";
};

const KITCHEN_KW = /кухн|kitchen|кут/i;
const FITTINGS_KW = /фурн|blum|het|петл|направ/i;
const COUNTER_KW = /стільниц|counter|столеш/i;

export function buildEstimateSuggestions(
  lines: LineLike[],
  opts: {
    totalPrice: number;
    grossMargin: number | null;
    discountAmount: number;
  },
): EstimateSuggestion[] {
  const out: EstimateSuggestion[] = [];
  const names = lines.map((l) => l.productName.toLowerCase()).join(" ");

  const hasDelivery = lines.some((l) => l.categoryKey === "delivery");
  const hasInstall = lines.some((l) => l.categoryKey === "installation");
  const hasFittings = lines.some((l) => l.categoryKey === "fittings");
  const hasCounter = lines.some((l) => l.categoryKey === "countertop");

  if (KITCHEN_KW.test(names) && !hasCounter) {
    out.push({
      id: "counter",
      text: "Для кухні немає стільниці в позиціях — додайте або уточніть у клієнта.",
      tone: "warning",
    });
  }

  if (!hasFittings && lines.length > 0) {
    out.push({
      id: "fittings",
      text: "Фурнітура не виділена окремо — перевірте комплектацію.",
      tone: "info",
    });
  }

  if (!hasInstall) {
    out.push({
      id: "install",
      text: "Монтаж не додано — якщо входить у пропозицію, додайте рядок або винесіть у договір.",
      tone: "info",
    });
  }

  if (!hasDelivery) {
    out.push({
      id: "delivery",
      text: "Доставка не вказана — додайте, якщо входить у ціну для клієнта.",
      tone: "info",
    });
  }

  const zeroPrice = lines.filter((l) => l.salePrice <= 0 && l.qty > 0);
  if (zeroPrice.length > 0) {
    out.push({
      id: "zero",
      text: `Є позиції з ціною 0 — заповніть ціни або позначте як орієнтовні в нотатках.`,
      tone: "warning",
    });
  }

  if (opts.totalPrice > 0 && opts.totalPrice < 5000) {
    out.push({
      id: "low-total",
      text: "Загальна сума виглядає низькою для повного меблевого комплекту — перевірте одиниці та кількості.",
      tone: "warning",
    });
  }

  if (opts.grossMargin != null && opts.grossMargin < 0) {
    out.push({
      id: "margin-neg",
      text: "Маржа від'ємна — перевірте собівартість або ціни продажу.",
      tone: "warning",
    });
  } else if (opts.grossMargin != null && opts.grossMargin > 0 && opts.grossMargin < opts.totalPrice * 0.08) {
    out.push({
      id: "margin-low",
      text: "Маржа низька — переконайтеся, що умови узгоджені з керівником.",
      tone: "warning",
    });
  }

  if (lines.length > 2 && out.filter((s) => s.tone === "warning").length === 0) {
    out.push({
      id: "proposal-ready",
      text: "Можна сформувати КП — знімок зафіксує суми для клієнта.",
      tone: "success",
    });
  }

  return out.slice(0, 8);
}
