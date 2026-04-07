import { openAiChatJson } from "../../features/ai/core/openai-client";
import type { PriceImportRowNorm } from "./price-import-excel";
import { inferBrand, inferCategory } from "./price-import-excel";

export type AiEnrichedPriceRow = {
  sourceIndex: number;
  groupKey: string;
  category: string | null;
  brand: string | null;
  name: string;
  displayName: string | null;
  unit: string;
  price: number | null;
  /** Чи включати рядок у збереження за замовчуванням */
  selected: boolean;
  /** Короткий коментар моделі (дублікат, злиття тощо) */
  note: string | null;
};

const BATCH = 36;

export function heuristicEnrichRows(
  rows: PriceImportRowNorm[],
): AiEnrichedPriceRow[] {
  return rows.map((row, sourceIndex) => fallbackFromHeuristic(row, sourceIndex));
}

function fallbackFromHeuristic(
  row: PriceImportRowNorm,
  sourceIndex: number,
): AiEnrichedPriceRow {
  const brand = row.brand ?? inferBrand(row.name);
  const category = row.category ?? inferCategory(row.name);
  const slug = [category ?? "misc", brand ?? "na", row.name.slice(0, 40)]
    .join("·")
    .toLowerCase()
    .replace(/\s+/g, "_");
  return {
    sourceIndex,
    groupKey: slug.slice(0, 80),
    category,
    brand,
    name: row.name,
    displayName:
      row.displayName ??
      (brand ? `${brand} · ${row.name}` : row.name),
    unit: row.unit || "шт",
    price: row.price,
    selected: true,
    note: null,
  };
}

/**
 * AI нормалізує назви, групує схожі позиції (groupKey), категорії/бренди.
 * Пакетами, щоб вкластися в ліміт токенів. Якщо AI недоступний — евристика.
 */
export async function enrichPriceRowsWithAi(
  rows: PriceImportRowNorm[],
): Promise<{ rows: AiEnrichedPriceRow[]; usedAi: boolean; aiError?: string }> {
  if (rows.length === 0) {
    return { rows: [], usedAi: false };
  }

  const out: AiEnrichedPriceRow[] = [];
  let usedAi = false;
  let aiError: string | undefined;

  for (let offset = 0; offset < rows.length; offset += BATCH) {
    const slice = rows.slice(offset, offset + BATCH);
    const payload = slice.map((r, i) => ({
      i: offset + i,
      name: r.name,
      unit: r.unit,
      price: r.price,
      category: r.category,
      brand: r.brand,
      externalId: r.externalId,
    }));

    const res = await openAiChatJson<{
      items?: Array<{
        sourceIndex: number;
        groupKey: string;
        category?: string | null;
        brand?: string | null;
        name: string;
        displayName?: string | null;
        unit: string;
        price?: number | null;
        selected?: boolean;
        note?: string | null;
      }>;
    }>({
      system: `Ти допомагаєш нормалізувати прайс будівельних/меблевих матеріалів для CRM.
Поверни СТРОГО JSON об'єкт одного формату:
{
  "items": [
    {
      "sourceIndex": число (індекс з вхідного масиву поля i),
      "groupKey": "короткий латинський slug для групи схожих товарів (напр. dsp_egger_18mm)",
      "category": "українською або null",
      "brand": "або null",
      "name": "повна нормалізована назва",
      "displayName": "коротка для списку або null",
      "unit": "од. виміру",
      "price": число або null,
      "selected": true/false — чи включати позицію в каталог (false для явних дублікатів/сміття),
      "note": "коротко українською або null"
    }
  ]
}
Для кожного входу має бути рівно один елемент items з тим самим sourceIndex що вхідний i.
Перевір ціни та одиниці; об'єднуй очевидні дублікати одним groupKey.`,
      user: JSON.stringify({ rows: payload }, null, 0),
      temperature: 0.25,
      maxTokens: 4000,
    });

    if (res.ok === false) {
      aiError = res.error;
      for (let j = 0; j < slice.length; j++) {
        out.push(fallbackFromHeuristic(slice[j]!, offset + j));
      }
      continue;
    }

    usedAi = true;
    const items = res.data.items ?? [];
    const byIdx = new Map<number, (typeof items)[0]>();
    for (const it of items) {
      if (typeof it.sourceIndex === "number") byIdx.set(it.sourceIndex, it);
    }

    for (let j = 0; j < slice.length; j++) {
      const srcIndex = offset + j;
      const row = slice[j]!;
      const ai = byIdx.get(srcIndex);
      if (!ai) {
        out.push(fallbackFromHeuristic(row, srcIndex));
        continue;
      }
      out.push({
        sourceIndex: srcIndex,
        groupKey: String(ai.groupKey || `row_${srcIndex}`).slice(0, 120),
        category: ai.category ?? row.category ?? inferCategory(row.name),
        brand: ai.brand ?? row.brand ?? inferBrand(row.name),
        name: String(ai.name || row.name).trim() || row.name,
        displayName:
          ai.displayName != null && String(ai.displayName).trim() !== ""
            ? String(ai.displayName).trim()
            : row.displayName ??
              (ai.brand || row.brand
                ? `${ai.brand || row.brand} · ${ai.name || row.name}`
                : row.name),
        unit: String(ai.unit || row.unit || "шт").trim() || "шт",
        price:
          typeof ai.price === "number" && Number.isFinite(ai.price)
            ? ai.price
            : row.price,
        selected: ai.selected !== false,
        note:
          typeof ai.note === "string" && ai.note.trim() !== ""
            ? ai.note.trim()
            : null,
      });
    }
  }

  return { rows: out, usedAi, aiError };
}
