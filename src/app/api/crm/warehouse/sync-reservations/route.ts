import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canProcurementAction } from "@/features/procurement/lib/permissions";
import { syncWarehouseReservationsFromProduction } from "@/features/warehouse/server/sync-reservations-from-production";

export async function POST() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  try {
    const user = await requireSessionUser();
    if (user instanceof NextResponse) return user;
    if (!canProcurementAction(user, "procurement.order.create")) {
      return NextResponse.json({ error: "Недостатньо прав для синхронізації резервів" }, { status: 403 });
    }

    const result = await syncWarehouseReservationsFromProduction(prisma);
    return NextResponse.json({
      ok: true,
      ...result,
      hint:
        "У задачах цеху (WORKSHOP) додайте metadataJson.warehouseReserve: [{ materialId, qty }] або materialCode.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Помилка сервера";
    console.error("[api/crm/warehouse/sync-reservations]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
