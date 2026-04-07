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

export async function GET(req: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  try {
    const user = await requireSessionUser();
    if (user instanceof NextResponse) return user;
    if (!canProcurementAction(user, "procurement.view")) {
      return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const take = Math.min(200, Math.max(10, Number(searchParams.get("take")) || 100));

    try {
      const movements = await prisma.warehouseStockMovement.findMany({
        take,
        orderBy: { createdAt: "desc" },
        include: {
          stockItem: {
            include: { material: { select: { name: true, code: true } } },
          },
        },
      });
      return NextResponse.json({
        movements: movements.map((m) => ({
          id: m.id,
          kind: m.kind,
          quantityDelta: m.quantityDelta,
          refKind: m.refKind,
          refId: m.refId,
          note: m.note,
          createdAt: m.createdAt.toISOString(),
          materialName: m.stockItem.material?.name ?? "—",
          materialCode: m.stockItem.material?.code ?? null,
        })),
      });
    } catch (error) {
      if (isOptionalSchemaError(error)) {
        return NextResponse.json({ movements: [] });
      }
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Помилка сервера";
    console.error("[api/crm/warehouse/movements]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
