import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import { prisma } from "../../../../../lib/prisma";

export const runtime = "nodejs";

type CommitItem = {
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

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.SETTINGS_MANAGE);
  if (denied) return denied;

  let body: {
    providerKey?: string;
    providerName?: string;
    mode?: string;
    items?: CommitItem[];
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const providerKeyRaw = String(body.providerKey ?? "import").trim();
  const providerNameRaw = String(body.providerName ?? "Імпорт").trim();
  const mode = String(body.mode ?? "append").trim().toLowerCase();
  const items = Array.isArray(body.items) ? body.items : [];

  if (items.length === 0) {
    return NextResponse.json({ error: "Немає позицій для збереження" }, { status: 400 });
  }

  const providerKey =
    providerKeyRaw.toLowerCase().replace(/\s+/g, "_") || "import";
  const providerName = providerNameRaw || providerKey.toUpperCase();

  const provider = await prisma.materialProvider.upsert({
    where: { key: providerKey },
    update: { name: providerName, isActive: true },
    create: { key: providerKey, name: providerName, kind: "catalog", isActive: true },
    select: { id: true, key: true, name: true },
  });

  let deleted = 0;
  if (mode === "replace") {
    const d = await prisma.materialCatalogItem.deleteMany({
      where: { providerId: provider.id },
    });
    deleted = d.count;
  }

  let upserted = 0;
  let skipped = 0;

  for (const row of items) {
    if (!row.name?.trim()) {
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
    upserted,
    skipped,
    deleted,
  });
}
