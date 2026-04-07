import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";

type Ctx = { params: Promise<{ dealId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { dealId } = await ctx.params;

  try {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, ownerId: true },
    });
    if (!deal) {
      return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
    }

    const denied = await forbidUnlessDealAccess(user, P.DEALS_VIEW, deal);
    if (denied) return denied;

    const rows = await prisma.readinessEvaluation.findMany({
      where: { dealId },
      orderBy: { evaluatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        outcome: true,
        allMet: true,
        checksJson: true,
        evaluatedAt: true,
      },
    });

    return NextResponse.json({
      items: rows.map((r) => ({
        id: r.id,
        outcome: r.outcome,
        allMet: r.allMet,
        checks: r.checksJson,
        evaluatedAt: r.evaluatedAt.toISOString(),
      })),
    });
  } catch (e) {
     
    console.error("[GET readiness-history]", e);
    return NextResponse.json({ error: "Помилка завантаження" }, { status: 500 });
  }
}
