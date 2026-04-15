import type { DraftLine } from "./ai-estimate-draft";
import type { EstimateCategoryKey } from "./estimate-categories";

/**
 * Орієнтовні ціни продажу за одиницю (грн, без ПДВ), коли в документі немає цифр.
 * Потрібно коригувати під реальний прайс компанії.
 */
export const INDICATIVE_UNIT_SALE_UAH: Record<EstimateCategoryKey, number> = {
  cabinets: 72_000,
  facades: 2_800,
  countertop: 3_800,
  fittings: 22_000,
  delivery: 2_800,
  installation: 14_000,
  extras: 4_500,
};

const CATEGORY_WEIGHT: Record<EstimateCategoryKey, number> = {
  cabinets: 1.25,
  facades: 1.15,
  countertop: 0.8,
  fittings: 0.7,
  delivery: 0.22,
  installation: 0.45,
  extras: 0.35,
};

function sumAmount(lines: DraftLine[]): number {
  return lines.reduce((a, l) => a + l.amountSale, 0);
}

function parseMoneyAmount(raw: string): number | null {
  const t = raw.replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(t);
  if (!Number.isFinite(n)) return null;
  return n;
}

function inferCategoryKey(line: DraftLine): EstimateCategoryKey {
  if (line.categoryKey) return line.categoryKey;
  const t = `${line.category ?? ""} ${line.productName}`.toLowerCase();
  if (/(достав|логіст|рейс|delivery)/.test(t)) return "delivery";
  if (/(монтаж|збірк|install)/.test(t)) return "installation";
  if (/(фасад|front|door)/.test(t)) return "facades";
  if (/(стільниц|столеш|counter|hpl|кварц)/.test(t)) return "countertop";
  if (/(фурнітур|blum|hettich|напрям|петл)/.test(t)) return "fittings";
  if (/(корпус|дсп|мдф|модул|шаф|гардероб|тумб)/.test(t)) return "cabinets";
  return "extras";
}

/**
 * Шукає типову «всього / до сплати» у тексті (грн, UAH).
 */
export function extractDocumentTotalUah(text: string): number | null {
  if (!text?.trim()) return null;
  const normalized = text.replace(/\u00A0/g, " ");
  const candidates: number[] = [];

  const labeled =
    /(?:всього|всього\s+до\s+сплати|разом|сума|итого|total|до\s+сплати)\s*[:\s]?\s*([\d\s]{2,}[.,]?\d*)\s*(?:грн|uah|UAH|₴)?/gi;
  let m: RegExpExecArray | null;
  while ((m = labeled.exec(normalized)) !== null) {
    const n = parseMoneyAmount(m[1]);
    if (n != null && n >= 500 && n <= 99_999_999) candidates.push(n);
  }

  if (candidates.length > 0) {
    return Math.max(...candidates);
  }

  const loose = /([\d\s]{4,}[.,]\d{2}|[\d\s]{5,})\s*(?:грн|uah|UAH|₴)/gi;
  while ((m = loose.exec(normalized)) !== null) {
    const n = parseMoneyAmount(m[1]);
    if (n != null && n >= 1_000 && n <= 99_999_999) candidates.push(n);
  }
  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

function extractCategoryTotalHintUah(
  text: string,
  keys: string[],
): number | null {
  if (!text?.trim()) return null;
  const normalized = text.replace(/\u00A0/g, " ");
  const joined = keys.join("|");
  const re = new RegExp(
    `(?:${joined})[^\\d]{0,26}([\\d\\s]{2,}[.,]?\\d*)\\s*(?:грн|uah|UAH|₴)?`,
    "gi",
  );
  const candidates: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(normalized)) !== null) {
    const n = parseMoneyAmount(m[1]);
    if (n != null && n >= 150 && n <= 99_999_999) candidates.push(n);
  }
  return candidates.length > 0 ? Math.max(...candidates) : null;
}

function applyCategoryTotals(lines: DraftLine[], fullText: string): {
  lines: DraftLine[];
  assumptions: string[];
} {
  const assumptions: string[] = [];
  const hints: Array<{ key: EstimateCategoryKey; total: number | null }> = [
    {
      key: "delivery",
      total: extractCategoryTotalHintUah(fullText, [
        "доставк",
        "логістик",
        "рейс",
        "delivery",
      ]),
    },
    {
      key: "installation",
      total: extractCategoryTotalHintUah(fullText, [
        "монтаж",
        "збірк",
        "установк",
        "install",
      ]),
    },
  ];
  let next = lines;
  for (const h of hints) {
    if (h.total == null || h.total <= 0) continue;
    const idx = next
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => inferCategoryKey(l) === h.key)
      .map(({ i }) => i);
    if (!idx.length) continue;
    const qtySum = idx.reduce((a, i) => a + Math.max(1, next[i]?.qty ?? 1), 0);
    if (qtySum <= 0) continue;
    next = next.map((l, i) => {
      if (!idx.includes(i)) return l;
      const qty = Math.max(1, l.qty);
      const amountSale = Math.round((h.total * qty) / qtySum * 100) / 100;
      const salePrice = Math.round((amountSale / qty) * 100) / 100;
      return { ...l, salePrice, amountSale };
    });
    assumptions.push(
      `Знайдено суму по "${h.key === "delivery" ? "доставці" : "монтажу"}" (~${Math.round(h.total).toLocaleString("uk-UA")} грн).`,
    );
  }
  return { lines: next, assumptions };
}

function fillZeroSaleWithIndicative(lines: DraftLine[]): DraftLine[] {
  return lines.map((l) => {
    if (l.salePrice > 0) return l;
    const sp = INDICATIVE_UNIT_SALE_UAH[inferCategoryKey(l)];
    const amountSale = Math.round(l.qty * sp * 100) / 100;
    return { ...l, salePrice: sp, amountSale };
  });
}

function allocateByDocumentTotal(lines: DraftLine[], targetTotal: number): DraftLine[] {
  if (targetTotal <= 0 || lines.length === 0) return lines;
  const weighted = lines.map((l) => {
    const qty = Number.isFinite(l.qty) && l.qty > 0 ? l.qty : 1;
    const key = inferCategoryKey(l);
    const w = qty * CATEGORY_WEIGHT[key] * Math.max(500, INDICATIVE_UNIT_SALE_UAH[key]);
    return { line: l, weight: Number.isFinite(w) && w > 0 ? w : 1 };
  });
  const totalWeight = weighted.reduce((a, x) => a + x.weight, 0);
  if (totalWeight <= 0) return lines;
  return weighted.map(({ line, weight }) => {
    const qty = Number.isFinite(line.qty) && line.qty > 0 ? line.qty : 1;
    const amountSale = Math.round((targetTotal * weight) / totalWeight * 100) / 100;
    const salePrice = Math.round((amountSale / qty) * 100) / 100;
    return { ...line, qty, salePrice, amountSale };
  });
}

function scaleLinesToTotal(lines: DraftLine[], targetTotal: number): DraftLine[] {
  const sum = sumAmount(lines);
  if (sum <= 0 || targetTotal <= 0) return lines;
  const factor = targetTotal / sum;
  return lines.map((l) => {
    const salePrice = Math.round(l.salePrice * factor * 100) / 100;
    const amountSale = Math.round(l.qty * salePrice * 100) / 100;
    return { ...l, salePrice, amountSale };
  });
}

/**
 * Підставляє орієнтовні ціни для нульових позицій; за потреби масштабує під суму з тексту.
 */
export function enrichDraftPricingFromText(
  lines: DraftLine[],
  fullText: string,
): { lines: DraftLine[]; extraAssumptions: string[] } {
  const extraAssumptions: string[] = [];
  if (lines.length === 0) return { lines, extraAssumptions };

  const hadAnyPrice = lines.some((l) => l.salePrice > 0);
  const docTotal = extractDocumentTotalUah(fullText);

  let next = lines;

  if (!hadAnyPrice) {
    if (docTotal != null) {
      next = allocateByDocumentTotal(lines, docTotal);
      extraAssumptions.push(
        `Суму рядків розподілено від загального підсумку документа (~${Math.round(docTotal).toLocaleString("uk-UA")} грн) з урахуванням категорій.`,
      );
    } else {
      next = fillZeroSaleWithIndicative(lines);
      extraAssumptions.push(
        "Орієнтовні ціни за категоріями (у документі не знайдено розцінок по рядках — уточніть під ваш прайс).",
      );
    }
  } else if (lines.some((l) => l.salePrice === 0)) {
    next = fillZeroSaleWithIndicative(lines);
    extraAssumptions.push(
      "Для позицій без ціни підставлено орієнтовні значення за категорією.",
    );
  }

  const withCategoryHints = applyCategoryTotals(next, fullText);
  next = withCategoryHints.lines;
  extraAssumptions.push(...withCategoryHints.assumptions);

  if (!hadAnyPrice && docTotal != null && sumAmount(next) > 0 && withCategoryHints.assumptions.length === 0) {
    next = scaleLinesToTotal(next, docTotal);
    extraAssumptions.push(
      `Підсумок вирівняно під суму з документа (~${Math.round(docTotal).toLocaleString("uk-UA")} грн).`,
    );
  } else if (hadAnyPrice && docTotal != null) {
    const s = sumAmount(next);
    if (s > 0 && Math.abs(s - docTotal) / docTotal > 0.12) {
      extraAssumptions.push(
        `У тексті знайдено суму ~${Math.round(docTotal).toLocaleString("uk-UA")} грн, сума рядків ${Math.round(s).toLocaleString("uk-UA")} — перевірте узгодженість.`,
      );
    }
  }

  return { lines: next, extraAssumptions };
}
