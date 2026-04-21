import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { hasEffectivePermission } from "@/lib/authz/permissions";
import { rejectHandoffToManager } from "@/lib/production-orchestration/service";

type Ctx = { params: Promise<{ dealId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { dealId } = await ctx.params;

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, ownerId: true },
  });
  if (!deal) {
    return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
  }

  const denied = await forbidUnlessDealAccess(user, P.DEALS_VIEW, deal);
  if (denied) return denied;

  if (
    !hasEffectivePermission(user.permissionKeys, P.PRODUCTION_ORCHESTRATION_MANAGE, {
      realRole: user.realRole,
      impersonatorId: user.impersonatorId,
    })
  ) {
    return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
  }

  let body: { reason?: string };
  try {
    body = (await req.json()) as { reason?: string };
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const reason = body.reason?.trim();
  if (!reason) {
    return NextResponse.json({ error: "Вкажіть причину повернення" }, { status: 400 });
  }

  const r = await rejectHandoffToManager(prisma, {
    dealId,
    actorUserId: user.id,
    reason,
  });

  if (r.ok === false) {
    return NextResponse.json({ error: r.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
