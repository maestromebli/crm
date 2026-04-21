import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser, forbidUnlessDealAccess } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";

type Ctx = { params: Promise<{ dealId: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const { dealId } = await ctx.params;

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      id: true,
      ownerId: true,
      pipelineId: true,
      stage: { select: { id: true, sortOrder: true } },
    },
  });
  if (!deal) {
    return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
  }
  const denied = await forbidUnlessDealAccess(user, P.DEALS_STAGE_CHANGE, deal);
  if (denied) return denied;

  const next = await prisma.pipelineStage.findFirst({
    where: { pipelineId: deal.pipelineId, sortOrder: deal.stage.sortOrder + 1 },
    select: { id: true },
  });
  if (!next) {
    return NextResponse.json({ ok: true, message: "Замовлення вже на фінальному етапі." });
  }

  const origin = new URL(_req.url);
  const patchResponse = await fetch(
    new URL(`/api/deals/${dealId}/stage`, `${origin.protocol}//${origin.host}`).toString(),
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: _req.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({ stageId: next.id }),
      cache: "no-store",
    },
  );
  const payload = await patchResponse.json().catch(() => ({}));
  return NextResponse.json(payload, { status: patchResponse.status });
}
