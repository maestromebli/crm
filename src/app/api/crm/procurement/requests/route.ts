import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canProcurementAction } from "@/features/procurement/lib/permissions";

type Line = {
  name?: string;
  qty?: number;
  plannedUnitCost?: number;
};

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
      return NextResponse.json({ error: "Оберіть угоду (проєкт)" }, { status: 400 });
    }

    const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { id: true } });
    if (!deal) {
      return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
    }

    const lines = (body.lines ?? []).filter((l) => (l.name ?? "").trim().length > 0);
    if (lines.length === 0) {
      return NextResponse.json({ error: "Додайте хоча б одну позицію з назвою" }, { status: 400 });
    }

    const neededByDate =
      body.neededByDate && body.neededByDate.trim()
        ? new Date(`${body.neededByDate}T12:00:00.000Z`)
        : null;

    const priority = (body.priority ?? "MEDIUM").trim() || "MEDIUM";

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
