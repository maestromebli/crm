import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser, forbidUnlessDealAccess } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";

type Ctx = { params: Promise<{ dealId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const { dealId } = await ctx.params;
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      ownerId: true,
      pipelineId: true,
      stage: { select: { sortOrder: true } },
    },
  });
  if (!deal) {
    return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
  }
  const denied = await forbidUnlessDealAccess(user, P.DEALS_STAGE_CHANGE, deal);
  if (denied) return denied;

  const body = await req.json().catch(() => ({} as { targetStageId?: string }));
  const targetStageId =
    typeof body.targetStageId === "string" && body.targetStageId.trim()
      ? body.targetStageId
      : null;
  const nextStage =
    targetStageId ??
    (await prisma.pipelineStage.findFirst({
      where: { pipelineId: deal.pipelineId, sortOrder: deal.stage.sortOrder + 1 },
      select: { id: true },
    }))?.id;

  if (!nextStage) {
    return NextResponse.json({ ok: true, message: "Стадія вже фінальна." });
  }

  const origin = new URL(req.url);
  const response = await fetch(
    new URL(`/api/deals/${dealId}/stage`, `${origin.protocol}//${origin.host}`).toString(),
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: req.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({ stageId: nextStage }),
      cache: "no-store",
    },
  );
  const payload = await response.json().catch(() => ({}));
  return NextResponse.json(payload, { status: response.status });
}
