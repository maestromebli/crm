import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canFinanceAction } from "@/features/finance/lib/permissions";

/** Короткий список угод для прив’язки проводок (фінанси). */
export async function GET() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  try {
    const user = await requireSessionUser();
    if (user instanceof NextResponse) return user;
    if (!canFinanceAction(user, "finance.view")) {
      return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
    }

    const deals = await prisma.deal.findMany({
      where: { status: { in: ["OPEN", "WON"] } },
      orderBy: { updatedAt: "desc" },
      take: 300,
      select: {
        id: true,
        title: true,
        value: true,
      },
    });

    return NextResponse.json({
      deals: deals.map((d) => ({
        id: d.id,
        title: d.title,
        value: d.value?.toString() ?? null,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Помилка сервера";
    console.error("[GET finance/deal-options]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
