import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { ownerIdWhere, resolveAccessContext } from "@/lib/authz/data-scope";
import { canProcurementAction } from "@/features/procurement/lib/permissions";

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
    const access = await resolveAccessContext(prisma, {
      id: user.id,
      role: user.dbRole,
    });
    const ownerFilter = ownerIdWhere(access);

    const deals = await prisma.deal.findMany({
      where: ownerFilter ? { ownerId: ownerFilter } : undefined,
      orderBy: { updatedAt: "desc" },
      take: 150,
      select: { id: true, title: true },
    });

    return NextResponse.json({ deals });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Помилка сервера";
    console.error("[api/crm/procurement/deals]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
