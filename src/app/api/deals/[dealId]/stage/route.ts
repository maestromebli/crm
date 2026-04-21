import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import { publishCrmEvent, CRM_EVENT_TYPES } from "@/lib/events/crm-events";
import { recordWorkflowEvent, WORKFLOW_EVENT_TYPES } from "@/features/event-system";
import { getRequestContext, writePlatformAudit } from "@/lib/platform";
import { logError } from "@/lib/observability/logger";
import {
  isStageTransitionFailure,
  transitionDealStage,
} from "@/lib/deals/stage-transition";

type Ctx = { params: Promise<{ dealId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const requestCtx = getRequestContext(req);
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { dealId } = await ctx.params;
  let body: { stageId?: string };
  try {
    body = (await req.json()) as { stageId?: string };
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  if (!body.stageId || typeof body.stageId !== "string") {
    return NextResponse.json({ error: "Потрібен stageId" }, { status: 400 });
  }

  try {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: {
        id: true,
        pipelineId: true,
        stageId: true,
        ownerId: true,
        value: true,
        workspaceMeta: true,
        stage: { select: { id: true, name: true, slug: true, sortOrder: true } },
        contract: { select: { status: true } },
        dealPaymentPlan: { select: { stepsJson: true } },
        productionFlow: { select: { id: true } },
        _count: {
          select: {
            estimates: true,
            dealPurchaseOrders: true,
          },
        },
      },
    });
    if (!deal) {
      return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
    }

    const denied = await forbidUnlessDealAccess(user, P.DEALS_STAGE_CHANGE, {
      ownerId: deal.ownerId,
    });
    if (denied) return denied;

    const userId = user.id;

    const transition = await transitionDealStage({
      dealId,
      stageId: body.stageId,
      changedById: userId,
    });
    if (isStageTransitionFailure(transition)) {
      return NextResponse.json(
        {
          error: transition.error,
          checklist: transition.checklist,
          blockers: transition.blockers,
          stage: transition.stage,
          nextStage: transition.nextStage,
        },
        { status: transition.status },
      );
    }

    await writePlatformAudit({
      entityType: "DEAL",
      entityId: dealId,
      type: "DEAL_STAGE_CHANGED",
      actorUserId: userId,
      requestId: requestCtx.requestId,
      correlationId: requestCtx.correlationId,
      data: {
        toStageId: transition.toStageId,
        toStageName: transition.toStageName,
      },
    });
    await publishCrmEvent({
      type: CRM_EVENT_TYPES.STAGE_CHANGED,
      dealId,
      payload: {
        fromStageId: transition.fromStageId,
        toStageId: transition.toStageId,
        toStageName: transition.toStageName,
      },
      dedupeKey: `stage:${dealId}:${transition.fromStageId}:${transition.toStageId}:${Date.now()}`,
    });
    if (transition.toStageSlug.toLowerCase().includes("production")) {
      await recordWorkflowEvent(
        WORKFLOW_EVENT_TYPES.PRODUCTION_TRANSFERRED,
        { dealId },
        {
          entityType: "DEAL",
          entityId: dealId,
          dealId,
          userId,
          dedupeKey: `production-transferred:${dealId}:${transition.toStageId}`,
        },
      );
    }

    revalidatePath(`/deals/${dealId}/workspace`);
    return NextResponse.json({
      ok: true,
      stageId: transition.toStageId,
      stageName: transition.toStageName,
    });
  } catch (e) {
    logError({
      module: "api.deals.stage",
      message: "Не вдалося оновити етап замовлення",
      requestId: requestCtx.requestId,
      correlationId: requestCtx.correlationId,
      details: { dealId, error: e instanceof Error ? e.message : String(e) },
    });
    return NextResponse.json({ error: "Помилка збереження" }, { status: 500 });
  }
}
