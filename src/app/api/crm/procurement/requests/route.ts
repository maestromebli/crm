import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canAccessOwner, resolveAccessContext } from "@/lib/authz/data-scope";
import { canProcurementAction } from "@/features/procurement/lib/permissions";

type Line = {
  name?: string;
  qty?: number;
  plannedUnitCost?: number;
};
const ALLOWED_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  try {
    const user = await requireSessionUser();
    if (user instanceof NextResponse) return user;
    if (!canProcurementAction(user, "procurement.request.create")) {
      return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
    }

    const body = (await req.json()) as {
      dealId?: string;
      lines?: Line[];
      neededByDate?: string | null;
      priority?: string | null;
      comment?: string | null;
    };

    const dealId = body.dealId?.trim() ?? "";
    if (!dealId) {
      return NextResponse.json({ error: "Оберіть замовлення (проєкт)" }, { status: 400 });
    }

    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, ownerId: true },
    });
    if (!deal) {
      return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
    }
    const access = await resolveAccessContext(prisma, {
      id: user.id,
      role: user.dbRole,
    });
    if (!canAccessOwner(access, deal.ownerId)) {
      return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
    }

    const lines = (body.lines ?? []).filter((l) => (l.name ?? "").trim().length > 0);
    if (lines.length === 0) {
      return NextResponse.json({ error: "Додайте хоча б одну позицію з назвою" }, { status: 400 });
    }

    const neededByDateRaw = body.neededByDate?.trim() ?? "";
    const neededByDate = neededByDateRaw ? new Date(`${neededByDateRaw}T12:00:00.000Z`) : null;
    if (neededByDate && Number.isNaN(neededByDate.getTime())) {
      return NextResponse.json({ error: "Невірний формат дати потреби" }, { status: 400 });
    }

    const priorityCandidate = (body.priority ?? "MEDIUM").trim().toUpperCase() || "MEDIUM";
    const priority = ALLOWED_PRIORITIES.has(priorityCandidate) ? priorityCandidate : "MEDIUM";

    const created = await prisma.procurementRequest.create({
      data: {
        dealId,
        source: "CRM_UI",
        status: "DRAFT",
        priority,
        neededByDate,
        items: {
          create: lines.map((line) => {
            const qty = Math.max(0.001, Number(line.qty ?? 1) || 1);
            const unit = Math.max(0, Number(line.plannedUnitCost ?? 0) || 0);
            return {
              name: line.name!.trim(),
              qtyPlanned: qty,
              qtyOrdered: 0,
              qtyReceived: 0,
              costPlanned: unit,
              costActual: 0,
              status: "DRAFT",
            };
          }),
        },
      },
      include: { items: true },
    });

    return NextResponse.json({ request: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Помилка сервера";
    console.error("[api/crm/procurement/requests]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
