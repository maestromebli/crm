import { NextResponse } from "next/server";
import { getDealWorkspacePayload } from "@/features/deal-workspace/queries";
import { prisma } from "@/lib/prisma";
import { resolveAccessContext } from "@/lib/authz/data-scope";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";

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

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { ownerId: true },
  });
  if (!deal) {
    return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
  }

  const denied = await forbidUnlessDealAccess(user, P.DEALS_VIEW, {
    ownerId: deal.ownerId,
  });
  if (denied) return denied;

  const accessCtx = await resolveAccessContext(prisma, {
    id: user.id,
    role: user.dbRole,
  });
  const payload = await getDealWorkspacePayload(dealId, accessCtx);
  if (!payload) {
    return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: payload });
}

