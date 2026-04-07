import { NextResponse } from "next/server";
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

type PatchBody = {
  storageZoneId?: string | null;
};

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ stockItemId: string }> },
) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }

  const { stockItemId } = await ctx.params;
  if (!stockItemId) {
    return NextResponse.json({ error: "Невірний ідентифікатор" }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const nextZoneId =
    body.storageZoneId === undefined
      ? undefined
      : body.storageZoneId === null || body.storageZoneId === ""
        ? null
        : String(body.storageZoneId);

  if (nextZoneId === undefined) {
    return NextResponse.json({ error: "Очікується storageZoneId" }, { status: 400 });
  }

  try {
    const user = await requireSessionUser();
    if (user instanceof NextResponse) return user;
    if (!canProcurementAction(user, "procurement.order.create")) {
      return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
    }

    const existing = await prisma.stockItem.findUnique({
      where: { id: stockItemId },
      include: { storageZone: { select: { id: true, code: true, name: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Позицію не знайдено" }, { status: 404 });
    }

    if (nextZoneId) {
      const zone = await prisma.warehouseStorageZone.findFirst({
        where: { id: nextZoneId, isActive: true },
      });
      if (!zone) {
        return NextResponse.json({ error: "Зону не знайдено або вона вимкнена" }, { status: 400 });
      }
    }

    const prevId = existing.storageZoneId ?? null;
    if (prevId === nextZoneId) {
      return NextResponse.json({
        ok: true,
        stockItem: {
          id: existing.id,
          storageZoneId: nextZoneId,
        },
        unchanged: true,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.stockItem.update({
        where: { id: stockItemId },
        data: { storageZoneId: nextZoneId },
      });

      try {
        await tx.warehouseStockMovement.create({
          data: {
            stockItemId,
            kind: "TRANSFER",
            quantityDelta: 0,
            refKind: "MANUAL",
            refId: stockItemId,
            fromZoneId: prevId,
            toZoneId: nextZoneId,
            createdById: user.id,
            note: "Зміна зони зберігання (WMS)",
          },
        });
      } catch (error) {
        if (!isOptionalSchemaError(error)) throw error;
      }
    });

    const updated = await prisma.stockItem.findUnique({
      where: { id: stockItemId },
      include: { storageZone: { select: { id: true, name: true, code: true, barcode: true } } },
    });

    return NextResponse.json({
      ok: true,
      stockItem: {
        id: updated?.id ?? stockItemId,
        storageZone: updated?.storageZone ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Помилка сервера";
    console.error("[api/crm/warehouse/stock PATCH]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
