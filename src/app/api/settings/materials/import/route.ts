import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import { prisma } from "../../../../../lib/prisma";
import { extractRowsFromSheet } from "../../../../../lib/materials/price-import-excel";

export const runtime = "nodejs";

export async function GET() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.SETTINGS_VIEW);
  if (denied) return denied;

  const providers = await prisma.materialProvider.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { items: true } },
    },
  });

  return NextResponse.json({
    providers: providers.map((p) => ({
      id: p.id,
      key: p.key,
      name: p.name,
      isActive: p.isActive,
      itemsCount: p._count.items,
      updatedAt: p.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.SETTINGS_MANAGE);
  if (denied) return denied;

  const form = await req.formData();
  const file = form.get("file");
  const providerKeyRaw = String(form.get("providerKey") ?? "viyar").trim();
  const providerNameRaw = String(form.get("providerName") ?? "VIYAR").trim();
  const mode = String(form.get("mode") ?? "append").trim().toLowerCase();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передано" }, { status: 400 });
  }

  const providerKey = providerKeyRaw.toLowerCase().replace(/\s+/g, "_") || "viyar";
  const providerName = providerNameRaw || providerKey.toUpperCase();

  const bytes = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(bytes, { type: "buffer" });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) {
    return NextResponse.json({ error: "Порожній Excel" }, { status: 400 });
  }

  const sheet = wb.Sheets[firstSheetName];
  const normalizedRows = extractRowsFromSheet(sheet);
  if (normalizedRows.length === 0) {
    return NextResponse.json({ error: "Не знайдено валідних рядків у прайсі" }, { status: 400 });
  }

  const provider = await prisma.materialProvider.upsert({
    where: { key: providerKey },
    update: { name: providerName, isActive: true },
    create: { key: providerKey, name: providerName, kind: "catalog", isActive: true },
    select: { id: true, key: true, name: true },
  });

  let deleted = 0;
  if (mode === "replace") {
    const d = await prisma.materialCatalogItem.deleteMany({ where: { providerId: provider.id } });
    deleted = d.count;
  }

  let upserted = 0;
  let skipped = 0;

  for (const row of normalizedRows) {
    if (!row.name.trim()) {
      skipped += 1;
      continue;
    }
    await prisma.materialCatalogItem.upsert({
      where: {
        providerId_externalId: {
          providerId: provider.id,
          externalId: row.externalId,
        },
      },
      update: {
        category: row.category,
        brand: row.brand,
        name: row.name,
        displayName: row.displayName,
        unit: row.unit,
        price: row.price,
        currency: "UAH",
        sourceUrl: row.sourceUrl,
        rawDataJson: row.rawDataJson as Prisma.InputJsonValue,
        syncedAt: new Date(),
      },
      create: {
        providerId: provider.id,
        externalId: row.externalId,
        category: row.category,
        brand: row.brand,
        name: row.name,
        displayName: row.displayName,
        unit: row.unit,
        price: row.price,
        currency: "UAH",
        sourceUrl: row.sourceUrl,
        rawDataJson: row.rawDataJson as Prisma.InputJsonValue,
        syncedAt: new Date(),
      },
    });
    upserted += 1;
  }

  return NextResponse.json({
    ok: true,
    provider,
    mode,
    importedRows: normalizedRows.length,
    upserted,
    skipped,
    deleted,
    fileName: file.name,
  });
}
