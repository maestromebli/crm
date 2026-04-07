import { prisma } from "../prisma";
import type { MaterialSearchHit, MaterialSearchResult } from "./material-provider";

/**
 * Пошук по локальному кешу каталогу (MaterialCatalogItem).
 */
export async function searchMaterialCatalog(
  query: string,
  opts?: { limit?: number; providerKey?: string },
): Promise<MaterialSearchResult> {
  const q = query.trim();
  const limit = Math.min(30, Math.max(1, opts?.limit ?? 12));
  if (!q) {
    return { query: q, items: [], source: "cache" };
  }

  const providerFilter =
    opts?.providerKey && opts.providerKey.toLowerCase() === "viyar"
      ? { provider: { key: "viyar" } }
      : {};

  const rows = await prisma.materialCatalogItem.findMany({
    where: {
      ...providerFilter,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { displayName: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { name: "asc" },
    include: { provider: { select: { key: true } } },
  });

  const items: MaterialSearchHit[] = rows.map((r) => {
    const label =
      r.displayName?.trim() ||
      [r.brand, r.name].filter(Boolean).join(" · ") ||
      r.name;
    const hintParts: string[] = [];
    if (r.price != null) {
      hintParts.push(
        `${r.price.toLocaleString("uk-UA")} ${r.currency}/${r.unit}`,
      );
    }
    if (r.category) hintParts.push(r.category);
    const supplier =
      r.provider.key === "viyar"
        ? "viyar"
        : r.provider.key === "manual"
          ? "manual"
          : "other";
    return {
      id: r.id,
      label,
      hint: hintParts.join(" · ") || undefined,
      supplier,
      unit: r.unit,
      unitPrice: r.price ?? undefined,
      currency: r.currency,
      externalId: r.externalId,
      providerKey: r.provider.key,
      category: r.category ?? null,
      brand: r.brand ?? null,
    };
  });

  return { query: q, items, source: "cache" };
}
