import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appendActivityLog } from "@/lib/deal-api/audit";
import { persistReadinessSnapshot } from "@/lib/deal-api/persist-readiness";
import { dispatchDealAutomationTrigger } from "@/lib/automation/dispatch";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { createProductionFlowFromDealHandoff } from "@/features/production/server/services/production-flow.service";
import { publishCrmEvent, CRM_EVENT_TYPES } from "@/lib/events/crm-events";

type Ctx = { params: Promise<{ dealId: string }> };

export async function POST(_req: Request, ctx: Ctx) {
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

    const denied = await forbidUnlessDealAccess(user, P.PRODUCTION_LAUNCH, deal);
    if (denied) return denied;

    const flow = await createProductionFlowFromDealHandoff({
      dealId,
      actorName: user.id,
      defaultChiefUserId: user.id,
    });

    await appendActivityLog({
      entityType: "DEAL",
      entityId: dealId,
      type: "DEAL_UPDATED",
      actorUserId: user.id,
      data: { productionFlowId: flow.id },
    });

    await persistReadinessSnapshot(dealId, user.id);
    await dispatchDealAutomationTrigger({
      dealId,
      trigger: "PRODUCTION_ORDER_CREATED",
      payload: { dealId, productionFlowId: flow.id },
      startedById: user.id,
    });
    await publishCrmEvent({
      type: CRM_EVENT_TYPES.PRODUCTION_STARTED,
      dealId,
      payload: { productionFlowId: flow.id },
      dedupeKey: `production:start:${flow.id}`,
    });

    revalidatePath(`/deals/${dealId}/workspace`);
    revalidatePath("/crm/production");
    revalidatePath("/production");
    return NextResponse.json({
      ok: true,
      productionFlowId: flow.id,
      launched: true,
      flowUrl: `/crm/production/${flow.id}`,
    });
  } catch (e) {
    console.error("[POST production-launch]", e);
    return NextResponse.json(
      { error: "Помилка створення виробничого замовлення" },
      { status: 500 },
    );
  }
}

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

    const flow = await prisma.productionFlow.findUnique({
      where: { dealId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const hasFlow = Boolean(flow);

    return NextResponse.json({
      status: hasFlow ? "LAUNCHED" : "NOT_READY",
      productionFlowId: flow?.id ?? null,
      queuedAt: flow?.createdAt.toISOString() ?? null,
      launchedAt: hasFlow ? flow?.createdAt.toISOString() ?? null : null,
      failedAt: null,
      error: null,
    });
  } catch (e) {
    console.error("[GET production-launch]", e);
    return NextResponse.json({ error: "Помилка завантаження" }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
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
  const denied = await forbidUnlessDealAccess(user, P.PRODUCTION_LAUNCH, deal);
  if (denied) return denied;

  let body: { action?: string; error?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  if (action === "retry") {
    const flow = await createProductionFlowFromDealHandoff({
      dealId,
      actorName: user.id,
      defaultChiefUserId: user.id,
    });
    revalidatePath(`/deals/${dealId}/workspace`);
    return NextResponse.json({ ok: true, status: "QUEUED", productionFlowId: flow.id });
  }

  return NextResponse.json({
    ok: true,
    message: "Стан launch більше не зберігається окремо — використовуйте модуль /crm/production.",
  });
}
