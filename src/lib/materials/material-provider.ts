/**
 * Абстракція джерел матеріалів (Viyar, інші каталоги).
 * Без реального API в реальному часі — кеш/імпорт + ручний оверрайд у формах.
 */

export type MaterialSearchHit = {
  id: string;
  label: string;
  /** Підказка ціни / од. виміру — може бути порожньою */
  hint?: string;
  supplier?: "viyar" | "manual" | "other";
  unit?: string;
  unitPrice?: number;
  currency?: string;
  externalId?: string;
  providerKey?: string;
  /** З рядка каталогу (MaterialCatalogItem), якщо є */
  category?: string | null;
  brand?: string | null;
};

export type MaterialSearchResult = {
  query: string;
  items: MaterialSearchHit[];
  /** Джерело: поки лише заглушка */
  source: "stub" | "cache";
};

/**
 * Пошук матеріалу за текстом: спочатку кеш каталогу, інакше порожньо (ручний ввід завжди ок).
 */
export async function searchMaterials(
  query: string,
  opts?: { limit?: number; provider?: "VIYAR" | "OTHER" | string },
): Promise<MaterialSearchResult> {
  const q = query.trim();
  if (!q) {
    return { query: q, items: [], source: "stub" };
  }
  try {
    const { searchMaterialCatalog } = await import("./material-catalog-search");
    const providerKey =
      opts?.provider === "VIYAR" || opts?.provider === "viyar"
        ? "viyar"
        : undefined;
    const r = await searchMaterialCatalog(q, {
      limit: opts?.limit,
      providerKey,
    });
    if (r.items.length > 0) return r;
  } catch {
    /* no DB / моделі */
  }
  return {
    query: q,
    items: [],
    source: "stub",
  };
}
