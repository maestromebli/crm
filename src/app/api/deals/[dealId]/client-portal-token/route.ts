import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser, forbidUnlessDealAccess } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { createClientPortalToken } from "@/lib/client-portal/token";

type Ctx = { params: Promise<{ dealId: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const { dealId } = await ctx.params;
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, ownerId: true },
  });
  if (!deal) return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
  const denied = await forbidUnlessDealAccess(user, P.DEALS_VIEW, deal);
  if (denied) return denied;
  try {
    const token = createClientPortalToken(dealId);
    return NextResponse.json({ token, url: `/client/${token}` });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Token error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
