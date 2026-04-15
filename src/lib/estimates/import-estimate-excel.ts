import type { DraftLine } from "./ai-estimate-draft";
import {
  encodeCategoryKey,
  lineTypeForCategory,
  type EstimateCategoryKey,
} from "./estimate-categories";
import { extractRowsFromSheet, inferCategory } from "../materials/price-import-excel";
import * as XLSX from "xlsx";

const MAX_IMPORT_LINES = 800;

const QTY_ALIASES = [
  "qty",
  "quantity",
  "кількість",
  "количество",
  "к-ть",
  "кол-во",
  "шт",
  "м2",
  "м²",
  "пог.м",
  "пог. м",
] as const;

const TOTAL_ALIASES = [
  "сума",
  "сумма",
  "итого",
  "разом",
  "всього",
  "всего",
  "total",
  "amount",
  "sum",
] as const;

const SKIP_ROW_RE =
  /^(итого|разом|всього|всего|підсумок|подсумок|subtotal|total|номер|№|n\/a|-{2,})$/i;
const SECTION_HEADER_RE =
  /^(стіл для переговорів|стіл для керівника|шафа)$/i;
const SECTION_SERVICE_ROW_RE =
  /(№\s*п\/п|найменування матеріалів|розрахунково|кіль-сть|коеф\.?|ціна[, ]|сума[, ])/i;
const SECTION_TOTAL_ROW_RE =
  /(загальна\s+собівартість|загальна\s+вартість|по\s+замовленню)/i;
const SECTION_HEADER_FORBIDDEN_RE =
  /(№\s*п\/п|найменування матеріалів|розрахунково|кіль-сть|коеф\.?|ціна[, ]|сума[, ]|загальна\s+собівартість|загальна\s+вартість|по\s+замовленню|итого|разом|всього|всего)/i;

function parseNumberish(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const raw = v.trim();
  if (!raw) return null;
  const compact = raw.replace(/\s+/g, "");
  const hasComma = compact.includes(",");
  const hasDot = compact.includes(".");
  let normalized = compact;
  if (hasComma && hasDot) {
    normalized = compact.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = compact.replace(",", ".");
  }
  normalized = normalized.replace(/[^\d.-]/g, "");
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/\s+/g, " ").trim();
}

function inferUnit(name: string, currentUnit: string): string {
  const u = (currentUnit || "").trim().toLowerCase();
  if (u && u !== "-" && u !== "—") return currentUnit;
  const n = name.toLowerCase();
  if (/(м2|м²|кв.м|кв м)/.test(n)) return "м²";
  if (/(пог\.?\s*м|м\.п)/.test(n)) return "пог. м";
  if (/(компл|комплект)/.test(n)) return "компл";
  return "шт";
}

function parseQtyFromRaw(raw: Record<string, unknown>): number {
  for (const [k, v] of Object.entries(raw)) {
    const key = normalizeKey(k);
    if (!QTY_ALIASES.some((a) => key.includes(a))) continue;
    const parsed = parseNumberish(v);
    if (parsed != null && parsed > 0) return parsed;
  }
  return 1;
}

function parseTotalFromRaw(raw: Record<string, unknown>): number | null {
  for (const [k, v] of Object.entries(raw)) {
    const key = normalizeKey(k);
    if (!TOTAL_ALIASES.some((a) => key.includes(a))) continue;
    const parsed = parseNumberish(v);
    if (parsed != null && parsed > 0) return parsed;
  }
  return null;
}

function shouldSkipName(name: string): boolean {
  const n = name.replace(/\s+/g, " ").trim();
  if (!n) return true;
  if (n.length < 2) return true;
  return SKIP_ROW_RE.test(n.toLowerCase());
}

function asCellText(v: unknown): string {
  if (typeof v === "string") return v.replace(/\s+/g, " ").trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function isSectionHeaderCandidate(colB: string, colC: string): boolean {
  if (!colB) return false;
  if (colC) return false;
  if (SECTION_HEADER_FORBIDDEN_RE.test(colB)) return false;
  if (/^[\d\s.,]+$/.test(colB)) return false;
  if (colB.length < 3) return false;
  return true;
}

function categoryKeyFromText(input: string): EstimateCategoryKey {
  const t = input.toLowerCase();
  if (/(доставк|логіст|transport|delivery)/.test(t)) return "delivery";
  if (/(монтаж|збірк|install)/.test(t)) return "installation";
  if (/(фасад|door|front|ручк|gola)/.test(t)) return "facades";
  if (/(стільниц|столеш|counter)/.test(t)) return "countertop";
  if (/(петл|напрям|фурнітур|фурнитур|blum|hettich)/.test(t)) return "fittings";
  if (/(дсп|ldsp|лдсп|мдф|корпус|шаф|тумб|модул|полиц)/.test(t)) return "cabinets";
  return "extras";
}

function parseOfficeSectionsFromSheet(sheet: XLSX.WorkSheet): {
  lines: DraftLine[];
  furnitureTypes: string[];
} {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });
  if (rows.length === 0) return { lines: [], furnitureTypes: [] };

  const lines: DraftLine[] = [];
  const furnitureTypes = new Set<string>();
  let currentSection: string | null = null;

  for (const row of rows) {
    if (!Array.isArray(row)) continue;

    const colB = asCellText(row[1]);
    const colC = asCellText(row[2]);
    const qtyCell = row[3];
    const coefCell = row[4];
    const priceCell = row[5];
    const sumCell = row[6];

    if (colB && (SECTION_HEADER_RE.test(colB) || isSectionHeaderCandidate(colB, colC))) {
      currentSection = colB;
      furnitureTypes.add(colB);
      continue;
    }

    if (!currentSection) continue;
    if (!colC) continue;
    if (SECTION_SERVICE_ROW_RE.test(colC)) continue;
    if (SECTION_TOTAL_ROW_RE.test(colC)) continue;
    if (shouldSkipName(colC)) continue;

    const qtyBase = parseNumberish(qtyCell);
    const qty = qtyBase != null && qtyBase > 0 ? qtyBase : 1;
    const coef = parseNumberish(coefCell);
    const effectiveQty =
      coef != null && coef > 0
        ? Math.max(0.0001, Math.round(qty * coef * 1000) / 1000)
        : Math.max(0.0001, qty);

    const price = parseNumberish(priceCell);
    const rowTotal = parseNumberish(sumCell);
    const salePriceBase =
      price != null && price > 0
        ? price
        : rowTotal != null && rowTotal > 0
          ? rowTotal / effectiveQty
          : 0;
    const salePrice = Math.max(0, Math.round(salePriceBase * 100) / 100);

    const productName = `${currentSection}: ${colC}`;
    const categoryKey = categoryKeyFromText(`${currentSection} ${colC}`);
    lines.push({
      type: lineTypeForCategory(categoryKey),
      category: encodeCategoryKey(categoryKey),
      categoryKey,
      productName,
      qty: effectiveQty,
      unit: inferUnit(colC, ""),
      salePrice,
      amountSale: Math.round(effectiveQty * salePrice * 100) / 100,
    });
  }

  return { lines, furnitureTypes: Array.from(furnitureTypes) };
}

export function buildEstimateDraftFromExcelBuffer(args: {
  fileBuffer: Buffer;
  fileName: string;
}): { lines: DraftLine[]; assumptions: string[]; missing: string[] } {
  const wb = XLSX.read(args.fileBuffer, { type: "buffer" });
  const sheetNames = wb.SheetNames;
  if (sheetNames.length === 0) {
    return {
      lines: [],
      assumptions: [],
      missing: ["Порожній Excel-файл"],
    };
  }

  const rawLines: DraftLine[] = [];
  const parsedSheets: string[] = [];
  const parsedSpecialSheets: string[] = [];
  const detectedFurnitureTypes = new Set<string>();

  for (const sheetName of sheetNames) {
    if (rawLines.length >= MAX_IMPORT_LINES) break;
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;

    const special = parseOfficeSectionsFromSheet(sheet);
    if (special.lines.length > 0) {
      parsedSheets.push(sheetName);
      parsedSpecialSheets.push(sheetName);
      for (const furnitureType of special.furnitureTypes) {
        detectedFurnitureTypes.add(furnitureType);
      }
      for (const line of special.lines) {
        if (rawLines.length >= MAX_IMPORT_LINES) break;
        rawLines.push(line);
      }
      continue;
    }

    const rows = extractRowsFromSheet(sheet);
    if (rows.length === 0) continue;
    parsedSheets.push(sheetName);
    for (const row of rows) {
      if (rawLines.length >= MAX_IMPORT_LINES) break;
      if (shouldSkipName(row.name)) continue;
      const inferred = inferCategory(row.name) ?? row.category ?? "";
      const categoryKey = categoryKeyFromText(`${row.name} ${inferred}`);
      const qty = Math.max(0.0001, parseQtyFromRaw(row.rawDataJson));
      const total = parseTotalFromRaw(row.rawDataJson);
      const salePriceBase =
        row.price != null && row.price > 0
          ? row.price
          : total != null && qty > 0
            ? total / qty
            : 0;
      const salePrice = Math.max(0, Math.round(salePriceBase * 100) / 100);
      const unit = inferUnit(row.name, row.unit || "");
      rawLines.push({
        type: lineTypeForCategory(categoryKey),
        category: encodeCategoryKey(categoryKey),
        categoryKey,
        productName: row.name,
        qty,
        unit,
        salePrice,
        amountSale: Math.round(qty * salePrice * 100) / 100,
      });
    }
  }

  const dedup = new Map<string, DraftLine>();
  for (const line of rawLines) {
    const key = [
      line.productName.toLowerCase().replace(/\s+/g, " ").trim(),
      line.unit.toLowerCase(),
      line.category ?? "",
    ].join("|");
    const prev = dedup.get(key);
    if (!prev) {
      dedup.set(key, line);
      continue;
    }
    const nextPrice = prev.salePrice > 0 ? prev.salePrice : line.salePrice;
    const nextQty = prev.qty + line.qty;
    dedup.set(key, {
      ...prev,
      qty: Math.round(nextQty * 1000) / 1000,
      salePrice: nextPrice,
      amountSale: Math.round(nextQty * nextPrice * 100) / 100,
    });
  }
  const lines = Array.from(dedup.values()).slice(0, MAX_IMPORT_LINES);

  return {
    lines,
    assumptions: [
      `Імпорт з Excel: ${args.fileName}`,
      `Аркушів прочитано: ${parsedSheets.length}`,
      parsedSheets.length > 0
        ? `Аркуші: ${parsedSheets.slice(0, 5).join(", ")}${parsedSheets.length > 5 ? "…" : ""}`
        : "Аркуші: не визначено",
      parsedSpecialSheets.length > 0
        ? `Спец-формат офісних меблів: ${parsedSpecialSheets.join(", ")}`
        : "Спец-формат офісних меблів: не виявлено",
      detectedFurnitureTypes.size > 0
        ? `Типи меблів: ${Array.from(detectedFurnitureTypes).join(", ")}`
        : "Типи меблів: не визначено",
      `Розпізнано позицій: ${lines.length}`,
    ],
    missing: lines.length === 0 ? ["Не знайдено валідних рядків у файлі"] : [],
  };
}
