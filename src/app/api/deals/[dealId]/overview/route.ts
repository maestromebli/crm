import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbidUnlessDealAccess, requireSessionUser } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { mapEffectiveRoleToDealHubRole } from "@/lib/deal-hub-api/permissions";
import { queryDealHubOverview } from "@/lib/deal-hub-api/queries";

type Ctx = { params: Promise<{ dealId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const { dealId } = await ctx.params;

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { ownerId: true },
  });
  if (!deal) {
    return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
  }
  const denied = await forbidUnlessDealAccess(user, P.DEALS_VIEW, deal);
  if (denied) return denied;

  const data = await queryDealHubOverview(
    dealId,
    mapEffectiveRoleToDealHubRole(user.dbRole),
  );
  if (!data) {
    return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, data });
}
