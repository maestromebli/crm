import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canAccessOwner, resolveAccessContext } from "@/lib/authz/data-scope";
import { canProcurementAction } from "@/features/procurement/lib/permissions";

type Params = {
  params: Promise<{ requestId: string }>;
};

export async function GET(_req: Request, { params }: Params) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  try {
    const user = await requireSessionUser();
    if (user instanceof NextResponse) return user;
    if (!canProcurementAction(user, "procurement.view")) {
      return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
    }

    const { requestId } = await params;
    if (!requestId?.trim()) {
      return NextResponse.json({ error: "Не вказано ідентифікатор заявки" }, { status: 400 });
    }

    const request = await prisma.procurementRequest.findUnique({
      where: { id: requestId },
      select: { id: true, deal: { select: { ownerId: true } } },
    });
    if (!request) {
      return NextResponse.json({ error: "Заявку не знайдено" }, { status: 404 });
    }

    const access = await resolveAccessContext(prisma, {
      id: user.id,
      role: user.dbRole,
    });
    if (!canAccessOwner(access, request.deal.ownerId)) {
      return NextResponse.json({ error: "Заявку не знайдено" }, { status: 404 });
    }

    const rows = await prisma.procurementRequestStatusHistory.findMany({
      where: { requestId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        fromStatus: true,
        toStatus: true,
        actorRole: true,
        reason: true,
        payload: true,
        createdAt: true,
        actor: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ history: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Помилка сервера";
    console.error("[api/crm/procurement/requests/[requestId]/history]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
