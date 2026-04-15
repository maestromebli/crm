import type { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import { prisma } from "../../../lib/prisma";
import { extractRowsFromSheet } from "../../../lib/materials/price-import-excel";
import type {
  SupplierPriceChangeEntry,
  SupplierSyncSummary,
} from "../core/supplierTypes";

type NormalizedRow = {
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

function parseCsvRows(text: string): NormalizedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0]?.split(/[;,]/).map((x) => x.trim().toLowerCase()) ?? [];
  const idx = (keys: string[]) => headers.findIndex((h) => keys.some((k) => h.includes(k)));
  const nameI = idx(["наймен", "name"]);
  const codeI = idx(["код", "артик", "sku", "id"]);
  const priceI = idx(["ціна", "price", "грн"]);
  const unitI = idx(["од", "unit"]);
  const categoryI = idx(["катег", "group"]);
  const brandI = idx(["brand", "бренд", "вироб"]);
  return lines.slice(1).reduce<NormalizedRow[]>((acc, line, i) => {
    const cols = line.split(/[;,]/).map((x) => x.trim());
    const name = cols[nameI] ?? cols[0] ?? "";
    if (!name) return acc;
    const priceRaw = (cols[priceI] ?? "").replace(",", ".").replace(/[^\d.]/g, "");
    const price = priceRaw ? Number.parseFloat(priceRaw) : null;
    const code = cols[codeI] || `csv_${i}_${name.toLowerCase().replace(/\s+/g, "_").slice(0, 20)}`;
    acc.push({
      externalId: code,
      name,
      displayName: null,
      category: cols[categoryI] || null,
      brand: cols[brandI] || null,
      unit: cols[unitI] || "шт",
      price: Number.isFinite(price ?? NaN) ? price : null,
      sourceUrl: null,
      rawDataJson: { row: line },
    });
    return acc;
  }, []);
}

function normalizeFileRows(fileName: string, bytes: Buffer): NormalizedRow[] {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) {
    return parseCsvRows(bytes.toString("utf-8"));
  }
  const wb = XLSX.read(bytes, { type: "buffer" });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];
  return extractRowsFromSheet(wb.Sheets[firstSheetName] as XLSX.WorkSheet);
}

export async function runSupplierFileSync(args: {
  providerKey: string;
  providerName: string;
  mode: "append" | "replace";
  fileName: string;
  bytes: Buffer;
}): Promise<SupplierSyncSummary> {
  const providerKey = args.providerKey.trim().toLowerCase().replace(/\s+/g, "_");
  const providerName = args.providerName.trim() || providerKey.toUpperCase();
  const rows = normalizeFileRows(args.fileName, args.bytes);
  if (!rows.length) {
    throw new Error("Не знайдено валідних позицій у файлі");
  }

  const provider = await prisma.materialProvider.upsert({
    where: { key: providerKey },
    update: { name: providerName, isActive: true },
    create: { key: providerKey, name: providerName, kind: "catalog", isActive: true },
    select: { id: true, key: true, name: true },
  });

  let deleted = 0;
  if (args.mode === "replace") {
    const d = await prisma.materialCatalogItem.deleteMany({ where: { providerId: provider.id } });
    deleted = d.count;
  }

  const incomingCodes = new Set(rows.map((r) => r.externalId));
  const existingRows = await prisma.materialCatalogItem.findMany({
    where: { providerId: provider.id },
    select: { id: true, externalId: true, name: true, price: true, rawDataJson: true },
  });
  const existingByCode = new Map(existingRows.map((r) => [r.externalId, r]));

  let upserted = 0;
  let skipped = 0;
  let changedPrices = 0;
  const priceChangeLogs: Array<{
    providerKey: string;
    providerName: string;
    itemExternalId: string;
    itemName: string;
    previousPrice: number;
    currentPrice: number;
    currency: string;
  }> = [];
  for (const row of rows) {
    if (!row.name.trim()) {
      skipped += 1;
      continue;
    }
    const existing = existingByCode.get(row.externalId);
    const wasChanged =
      existing && row.price != null && existing.price != null && Math.abs(existing.price - row.price) > 0.009;
    if (wasChanged) {
      changedPrices += 1;
      priceChangeLogs.push({
        providerKey: provider.key,
        providerName: provider.name,
        itemExternalId: row.externalId,
        itemName: row.displayName?.trim() || row.name || existing?.name || row.externalId,
        previousPrice: existing.price ?? 0,
        currentPrice: row.price ?? 0,
        currency: "UAH",
      });
    }
    await prisma.materialCatalogItem.upsert({
      where: {
        providerId_externalId: { providerId: provider.id, externalId: row.externalId },
      },
      update: {
        category: row.category,
        brand: row.brand,
        name: row.name,
        displayName: row.displayName,
        unit: row.unit || "шт",
        price: row.price,
        currency: "UAH",
        sourceUrl: row.sourceUrl,
        rawDataJson: {
          ...(existing?.rawDataJson && typeof existing.rawDataJson === "object"
            ? (existing.rawDataJson as Prisma.JsonObject)
            : {}),
          ...(row.rawDataJson as Prisma.JsonObject),
          outdated: false,
          lastSyncSource: args.fileName,
        } as Prisma.InputJsonValue,
        syncedAt: new Date(),
      },
      create: {
        providerId: provider.id,
        externalId: row.externalId,
        category: row.category,
        brand: row.brand,
        name: row.name,
        displayName: row.displayName,
        unit: row.unit || "шт",
        price: row.price,
        currency: "UAH",
        sourceUrl: row.sourceUrl,
        rawDataJson: {
          ...(row.rawDataJson as Prisma.JsonObject),
          outdated: false,
          lastSyncSource: args.fileName,
        } as Prisma.InputJsonValue,
        syncedAt: new Date(),
      },
    });
    upserted += 1;
  }

  if (priceChangeLogs.length > 0) {
    await prisma.supplierPriceChange.createMany({
      data: priceChangeLogs,
    });
  }

  let markedOutdated = 0;
  const outdated = existingRows.filter((x) => !incomingCodes.has(x.externalId));
  for (const row of outdated) {
    markedOutdated += 1;
    await prisma.materialCatalogItem.update({
      where: { id: row.id },
      data: {
        rawDataJson: {
          ...(row.rawDataJson && typeof row.rawDataJson === "object"
            ? (row.rawDataJson as Prisma.JsonObject)
            : {}),
          outdated: true,
        } as Prisma.InputJsonValue,
      },
    });
  }

  return {
    providerKey: provider.key,
    providerName: provider.name,
    importedRows: rows.length,
    upserted,
    changedPrices,
    markedOutdated,
    skipped,
    deleted,
    syncedAt: new Date().toISOString(),
  };
}

export async function getSupplierSyncStatus(providerKey?: string): Promise<{
  providers: Array<{
    key: string;
    name: string;
    itemsCount: number;
    lastUpdate: string | null;
  }>;
  recentPriceChanges: SupplierPriceChangeEntry[];
}> {
  const providers = await prisma.materialProvider.findMany({
    where: providerKey ? { key: providerKey } : undefined,
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { items: true } },
      items: { select: { updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 1 },
    },
  });
  const recentPriceChanges = await prisma.supplierPriceChange.findMany({
    where: providerKey ? { providerKey } : undefined,
    orderBy: { changedAt: "desc" },
    take: 40,
  });

  return {
    providers: providers.map((p) => ({
      key: p.key,
      name: p.name,
      itemsCount: p._count.items,
      lastUpdate: p.items[0]?.updatedAt?.toISOString() ?? null,
    })),
    recentPriceChanges: recentPriceChanges.map((x) => ({
      id: x.id,
      providerKey: x.providerKey,
      providerName: x.providerName,
      itemExternalId: x.itemExternalId,
      itemName: x.itemName,
      previousPrice: x.previousPrice,
      currentPrice: x.currentPrice,
      currency: "UAH",
      changedAt: x.changedAt.toISOString(),
    })),
  };
}
