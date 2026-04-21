import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canAccessOwner, resolveAccessContext } from "@/lib/authz/data-scope";
import { canProcurementAction } from "@/features/procurement/lib/permissions";

const ALLOWED_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

type Params = {
  params: Promise<{ requestId: string }>;
};

export async function PATCH(req: Request, { params }: Params) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  try {
    const user = await requireSessionUser();
    if (user instanceof NextResponse) return user;
    if (!canProcurementAction(user, "procurement.request.approve")) {
      return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
    }

    const { requestId } = await params;
    if (!requestId?.trim()) {
      return NextResponse.json({ error: "Не вказано ідентифікатор заявки" }, { status: 400 });
    }

    const body = (await req.json()) as { priority?: string };
    const priority = (body.priority ?? "").trim().toUpperCase();
    if (!ALLOWED_PRIORITIES.has(priority)) {
      return NextResponse.json({ error: "Невірний пріоритет" }, { status: 400 });
    }

    const existing = await prisma.procurementRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        status: true,
        deal: { select: { ownerId: true } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Заявку не знайдено" }, { status: 404 });
    }

    const access = await resolveAccessContext(prisma, {
      id: user.id,
      role: user.dbRole,
    });
    if (!canAccessOwner(access, existing.deal.ownerId)) {
      return NextResponse.json({ error: "Заявку не знайдено" }, { status: 404 });
    }
    if (existing.status === "CLOSED" || existing.status === "CANCELLED") {
      return NextResponse.json({ error: "Неможливо змінити пріоритет закритої заявки" }, { status: 409 });
    }

    const updated = await prisma.procurementRequest.update({
      where: { id: requestId },
      data: { priority },
      select: { id: true, priority: true, status: true },
    });

    return NextResponse.json({ request: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Помилка сервера";
    console.error("[api/crm/procurement/requests/[requestId]/priority]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
