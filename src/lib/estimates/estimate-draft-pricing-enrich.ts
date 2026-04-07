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

function sumAmount(lines: DraftLine[]): number {
  return lines.reduce((a, l) => a + l.amountSale, 0);
}

function parseMoneyAmount(raw: string): number | null {
  const t = raw.replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(t);
  if (!Number.isFinite(n)) return null;
  return n;
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

function fillZeroSaleWithIndicative(lines: DraftLine[]): DraftLine[] {
  return lines.map((l) => {
    if (l.salePrice > 0) return l;
    const sp = INDICATIVE_UNIT_SALE_UAH[l.categoryKey];
    const amountSale = Math.round(l.qty * sp * 100) / 100;
    return { ...l, salePrice: sp, amountSale };
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
    next = fillZeroSaleWithIndicative(lines);
    extraAssumptions.push(
      "Орієнтовні ціни за категоріями (у документі не знайдено розцінок по рядках — уточніть під ваш прайс).",
    );
  } else if (lines.some((l) => l.salePrice === 0)) {
    next = fillZeroSaleWithIndicative(lines);
    extraAssumptions.push(
      "Для позицій без ціни підставлено орієнтовні значення за категорією.",
    );
  }

  if (!hadAnyPrice && docTotal != null && sumAmount(next) > 0) {
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
