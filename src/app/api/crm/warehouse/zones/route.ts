import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canProcurementAction } from "@/features/procurement/lib/permissions";

function isOptionalSchemaError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

function makeBarcode(code: string): string {
  const clean = code.replace(/[^\w\u0400-\u04FF-]+/g, "").slice(0, 24) || "Z";
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `WH-${clean}-${suffix}`;
}

export async function GET() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  try {
    const user = await requireSessionUser();
    if (user instanceof NextResponse) return user;
    if (!canProcurementAction(user, "procurement.view")) {
      return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
    }

    try {
      const zones = await prisma.warehouseStorageZone.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
      return NextResponse.json({ zones });
    } catch (error) {
      if (isOptionalSchemaError(error)) {
        return NextResponse.json({ zones: [] });
      }
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Помилка сервера";
    console.error("[api/crm/warehouse/zones GET]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  try {
    const user = await requireSessionUser();
    if (user instanceof NextResponse) return user;
    if (!canProcurementAction(user, "procurement.order.create")) {
      return NextResponse.json({ error: "Недостатньо прав для створення зони" }, { status: 403 });
    }

    const body = (await req.json()) as { name?: string; code?: string; sortOrder?: number };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!name || !code) {
      return NextResponse.json({ error: "Потрібні name та code" }, { status: 400 });
    }

    const barcode = makeBarcode(code);

    try {
      const zone = await prisma.warehouseStorageZone.create({
        data: {
          name,
          code,
          barcode,
          sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
        },
      });
      return NextResponse.json({ zone });
    } catch (error) {
      if (isOptionalSchemaError(error)) {
        return NextResponse.json(
          { error: "Таблиця зон ще не застосована в БД (міграція)." },
          { status: 503 },
        );
      }
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Помилка сервера";
    console.error("[api/crm/warehouse/zones POST]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
