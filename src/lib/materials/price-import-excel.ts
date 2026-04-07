import { createHash } from "node:crypto";
import type { WorkSheet } from "xlsx";
import * as XLSX from "xlsx";

export type PriceImportRowNorm = {
  externalId: string;
  name: string;
  displayName: string | null;
  category: string | null;
  brand: string | null;
  unit: string;
  price: number | null;
  sourceUrl: string | null;
  rawDataJson: Record<string, unknown>;
};

const HEADER_ALIASES = {
  name: ["найменування", "наименование", "name", "товар", "material"],
  price: ["ціна", "цена", "price", "ціна грн", "price uah", "грн"],
  unit: ["од", "ед", "unit", "одиниця", "ед.", "од."],
  brand: ["бренд", "brand", "виробник", "производитель"],
  category: ["категорія", "категория", "category", "група", "group"],
  externalId: ["код", "артикул", "sku", "id"],
  sourceUrl: ["url", "посилання", "ссылка", "link"],
} as const;

function normalizeHeader(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(v: unknown): string {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}

function parsePrice(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v ?? "")
    .replace(/[₴$€грнuahUAH\s]/g, "")
    .replace(/,/g, ".")
    .trim();
  if (!s) return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function inferBrand(name: string): string | null {
  const n = name.toLowerCase();
  if (n.includes("egger")) return "Egger";
  if (n.includes("kronospan")) return "Kronospan";
  if (n.includes("swiss krono")) return "Swiss Krono";
  if (n.includes("blum")) return "Blum";
  if (n.includes("hettich")) return "Hettich";
  return null;
}

export function inferCategory(name: string): string | null {
  const n = name.toLowerCase();
  if (/(дсп|ldsp|лдсп|chipboard)/.test(n)) return "ДСП";
  if (/(мдф|mdf)/.test(n)) return "МДФ";
  if (/(стільниц|столеш)/.test(n)) return "Стільниці";
  if (/(кромк|edge)/.test(n)) return "Кромка";
  if (/(петл|напрям|фурнітур|фурнитур|ручк|blum|hettich)/.test(n))
    return "Фурнітура";
  return null;
}

function makeExternalId(parts: string[]): string {
  const h = createHash("sha1");
  h.update(parts.join("|"));
  return `auto_${h.digest("hex").slice(0, 20)}`;
}

function findColumnIndex(
  headers: string[],
  aliases: readonly string[],
): number {
  return headers.findIndex((h) => aliases.some((a) => h.includes(a)));
}

/**
 * Витягує нормалізовані рядки з першого аркуша Excel (xlsx).
 */
export function extractRowsFromSheet(sheet: WorkSheet): PriceImportRowNorm[] {
  const rowsRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });
  if (rowsRaw.length === 0) return [];

  const headers = Object.keys(rowsRaw[0] ?? {}).map(normalizeHeader);
  const headerKeys = Object.keys(rowsRaw[0] ?? {});

  const idxName = findColumnIndex(headers, HEADER_ALIASES.name);
  const idxPrice = findColumnIndex(headers, HEADER_ALIASES.price);
  const idxUnit = findColumnIndex(headers, HEADER_ALIASES.unit);
  const idxBrand = findColumnIndex(headers, HEADER_ALIASES.brand);
  const idxCategory = findColumnIndex(headers, HEADER_ALIASES.category);
  const idxExternalId = findColumnIndex(headers, HEADER_ALIASES.externalId);
  const idxSourceUrl = findColumnIndex(headers, HEADER_ALIASES.sourceUrl);

  const out: PriceImportRowNorm[] = [];
  for (const r of rowsRaw) {
    const name =
      idxName >= 0
        ? normalizeName(r[headerKeys[idxName]])
        : normalizeName(Object.values(r)[0]);
    if (!name) continue;

    const price =
      idxPrice >= 0
        ? parsePrice(r[headerKeys[idxPrice]])
        : parsePrice(Object.values(r)[1]);

    const unit =
      idxUnit >= 0
        ? normalizeName(r[headerKeys[idxUnit]]) || "шт"
        : normalizeName(Object.values(r)[2]) || "шт";

    const brand =
      (idxBrand >= 0 ? normalizeName(r[headerKeys[idxBrand]]) : "") ||
      inferBrand(name);

    const category =
      (idxCategory >= 0 ? normalizeName(r[headerKeys[idxCategory]]) : "") ||
      inferCategory(name);

    const externalIdRaw =
      idxExternalId >= 0 ? normalizeName(r[headerKeys[idxExternalId]]) : "";

    const sourceUrlRaw =
      idxSourceUrl >= 0 ? normalizeName(r[headerKeys[idxSourceUrl]]) : "";

    const externalId =
      externalIdRaw || makeExternalId([name.toLowerCase(), unit, brand ?? ""]);

    out.push({
      externalId,
      name,
      displayName: brand ? `${brand} · ${name}` : null,
      category: category || null,
      brand: brand || null,
      unit,
      price,
      sourceUrl: sourceUrlRaw || null,
      rawDataJson: r,
    });
  }

  return out;
}
