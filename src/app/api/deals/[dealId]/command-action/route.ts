import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbidUnlessDealAccess, requireSessionUser } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { executeDealHubCommandAction } from "@/lib/deal-hub-api/mutations";

type Ctx = { params: Promise<{ dealId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const { dealId } = await ctx.params;
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { ownerId: true },
  });
  if (!deal) {
    return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
  }
  const denied = await forbidUnlessDealAccess(user, P.DEALS_UPDATE, deal);
  if (denied) return denied;

  let body: { action?: string; payload?: Record<string, unknown> };
  try {
    body = (await req.json()) as { action?: string; payload?: Record<string, unknown> };
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }
  if (!body.action) {
    return NextResponse.json({ error: "Потрібен action" }, { status: 400 });
  }
  const data = await executeDealHubCommandAction({
    dealId,
    actorUserId: user.id,
    action: body.action,
    payload: body.payload,
  });
  return NextResponse.json({ ok: true, data });
}
