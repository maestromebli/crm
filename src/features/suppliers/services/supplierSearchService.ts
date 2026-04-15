import { prisma } from "../../../lib/prisma";
import type { SupplierItem, SupplierKey, SupplierSearchResult } from "../core/supplierTypes";
import { supplierRegistry } from "../core/supplierRegistry";
import "../providers/viyarProvider";
import "../providers/csvProvider";
import "../providers/manualProvider";
import { mapMaterialCatalogToSupplierItem } from "./supplierMappers";

type CacheEntry = {
  expiresAt: number;
  result: SupplierSearchResult;
};

const SEARCH_CACHE = new Map<string, CacheEntry>();
const SEARCH_CACHE_TTL_MS = 60_000;

const CYR_TO_LAT: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "h",
  ґ: "g",
  д: "d",
  е: "e",
  є: "ye",
  ж: "zh",
  з: "z",
  и: "y",
  і: "i",
  ї: "yi",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ь: "",
  ю: "yu",
  я: "ya",
};

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function translitUa(value: string): string {
  return [...normalizeText(value)]
    .map((c) => CYR_TO_LAT[c] ?? c)
    .join("");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cur = row[j] as number;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min((row[j - 1] as number) + 1, (row[j] as number) + 1, prev + cost);
      prev = cur;
    }
    row[0] = i;
  }
  return row[b.length] as number;
}

function scoreItem(query: string, item: SupplierItem): number {
  const q = normalizeText(query);
  const qTr = translitUa(q);
  const name = normalizeText(item.name);
  const nameTr = translitUa(name);
  let score = 0;

  if (name === q) score += 120;
  if (name.includes(q)) score += 80;
  if (nameTr.includes(qTr) || qTr.includes(nameTr)) score += 65;

  for (const token of q.split(" ").filter(Boolean)) {
    if (name.includes(token)) score += 18;
    if (nameTr.includes(translitUa(token))) score += 10;
  }

  const dist = levenshtein(q, name.slice(0, Math.max(q.length, 1) + 4));
  score += Math.max(0, 30 - dist * 3);

  // Fresh prices are more relevant when scores tie.
  const freshness = Date.now() - new Date(item.updatedAt).getTime();
  if (Number.isFinite(freshness) && freshness >= 0) {
    score += Math.max(0, 8 - Math.floor(freshness / (1000 * 60 * 60 * 24)));
  }

  return score;
}

export async function searchSupplierItems(
  query: string,
  opts?: { limit?: number; suppliers?: SupplierKey[] },
): Promise<SupplierSearchResult> {
  const started = Date.now();
  const q = query.trim();
  const limit = Math.min(50, Math.max(1, opts?.limit ?? 20));
  if (!q) {
    return { query: q, items: [], elapsedMs: 0, cached: false };
  }
  const cacheKey = JSON.stringify({ q: q.toLowerCase(), limit, suppliers: opts?.suppliers ?? [] });
  const cached = SEARCH_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.result, cached: true };
  }

  const rawItems = await supplierRegistry.searchAll({
    query: q,
    limit: Math.max(30, limit * 3),
    suppliers: opts?.suppliers,
  });
  const dedup = new Map<string, SupplierItem>();
  for (const item of rawItems) {
    const key = `${normalizeText(item.name)}|${normalizeText(item.code ?? "")}|${item.supplier}`;
    if (!dedup.has(key)) dedup.set(key, item);
  }
  const ranked = [...dedup.values()]
    .map((item) => ({ item, score: scoreItem(q, item) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.item);
  const result: SupplierSearchResult = {
    query: q,
    items: ranked,
    elapsedMs: Date.now() - started,
    cached: false,
  };
  SEARCH_CACHE.set(cacheKey, { result, expiresAt: Date.now() + SEARCH_CACHE_TTL_MS });
  return result;
}

export async function getSupplierItemById(id: string): Promise<SupplierItem | null> {
  const row = await prisma.materialCatalogItem.findUnique({
    where: { id },
    include: { provider: { select: { key: true } } },
  });
  if (!row) return null;
  return mapMaterialCatalogToSupplierItem(row);
}

export async function getSupplierItemsByIds(ids: string[]): Promise<SupplierItem[]> {
  const uniq = [...new Set(ids.map((x) => x.trim()).filter(Boolean))].slice(0, 200);
  if (!uniq.length) return [];
  const rows = await prisma.materialCatalogItem.findMany({
    where: { id: { in: uniq } },
    include: { provider: { select: { key: true } } },
  });
  return rows.map(mapMaterialCatalogToSupplierItem);
}

export async function buildSupplierAiHints(prompt: string): Promise<string[]> {
  const q = prompt.trim();
  if (!q) return [];
  const query = /(дсп|egger|h\d{3,4}|мдф|фасад)/i.test(q) ? q : "";
  if (!query) return [];
  const result = await searchSupplierItems(query, { limit: 8 });
  if (!result.items.length) return [];

  const hints: string[] = [];
  const variants = result.items
    .filter((x) => /дсп|ldsp|egger|h\d{3,4}/i.test(`${x.name} ${x.code ?? ""}`))
    .slice(0, 3);
  if (variants.length) {
    hints.push(`Supplier variants: ${variants.map((x) => x.name).join("; ")}.`);
  }
  const priced = result.items.filter((x) => x.price > 0);
  if (priced.length >= 2) {
    const sorted = [...priced].sort((a, b) => a.price - b.price);
    const cheapest = sorted[0];
    const premium = sorted[sorted.length - 1];
    if (cheapest && premium) {
      hints.push(
        `Cheapest option: ${cheapest.name} (${cheapest.price.toLocaleString("uk-UA")} грн/${cheapest.unit}).`,
      );
      hints.push(
        `Premium option: ${premium.name} (${premium.price.toLocaleString("uk-UA")} грн/${premium.unit}).`,
      );
    }
  }
  return hints;
}
