import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canProcurementAction } from "@/features/procurement/lib/permissions";

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  try {
    const user = await requireSessionUser();
    if (user instanceof NextResponse) return user;
    const canManage =
      canProcurementAction(user, "procurement.supplier.manage") ||
      canProcurementAction(user, "procurement.request.create");
    if (!canManage) {
      return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
    }

    const body = (await req.json()) as { name?: string; category?: string };
    const name = body.name?.trim() ?? "";
    const category = body.category?.trim() || "Загальне";
    if (!name) {
      return NextResponse.json({ error: "Вкажіть назву постачальника" }, { status: 400 });
    }

    const supplier = await prisma.supplier.create({
      data: { name, category },
    });

    return NextResponse.json({ supplier });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Помилка сервера";
    console.error("[api/crm/procurement/suppliers]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
