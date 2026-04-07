import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { hasEffectivePermission } from "@/lib/authz/permissions";
import { acceptProductionOrchestration } from "@/lib/production-orchestration/service";

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
    return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
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

  let body: { estimateId?: string | null } = {};
  try {
    const text = await req.text();
    if (text.trim()) {
      body = JSON.parse(text) as { estimateId?: string | null };
    }
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const result = await acceptProductionOrchestration(prisma, {
    dealId,
    actorUserId: user.id,
    estimateId: body.estimateId,
  });

  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : result.code === "CONFLICT" ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, orchestrationId: result.orchestrationId });
}
