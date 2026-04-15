import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDealAccess } from "@/lib/deal-hub-api/access";
import { appendActivityLog } from "@/lib/deal-api/audit";
import { P } from "@/lib/authz/permissions";

type Ctx = { params: Promise<{ dealId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { dealId } = await ctx.params;
  const access = await requireDealAccess(dealId);
  if ("error" in access) return access.error;

  const rows = await prisma.activityLog.findMany({
    where: {
      entityType: "DEAL",
      entityId: dealId,
      source: "USER",
    },
    orderBy: { createdAt: "desc" },
    take: 80,
    select: {
      id: true,
      type: true,
      data: true,
      createdAt: true,
      actorUser: { select: { name: true, email: true } },
    },
  });
  return NextResponse.json({ ok: true, data: rows });
}

export async function POST(req: Request, ctx: Ctx) {
  const { dealId } = await ctx.params;
  const access = await requireDealAccess(dealId, P.DEALS_UPDATE);
  if ("error" in access) return access.error;

  const body = await req.json().catch(() => ({} as { content?: string; isPinned?: boolean }));
  const content = String(body.content ?? "").trim();
  if (!content) {
    return NextResponse.json({ error: "Порожній текст нотатки" }, { status: 400 });
  }

  await appendActivityLog({
    entityType: "DEAL",
    entityId: dealId,
    type: "DEAL_UPDATED",
    actorUserId: access.user.id,
    source: "USER",
    data: { note: content, isPinned: Boolean(body.isPinned), createdAt: new Date().toISOString() } as any,
  });

  return NextResponse.json({ ok: true });
}
