import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { appendActivityLog } from "../../../../../lib/deal-api/audit";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import { canMoveToNextStage } from "@/lib/deal-os/flow-engine";
import { publishCrmEvent, CRM_EVENT_TYPES } from "@/lib/events/crm-events";
import { evaluateDealStageTransitionGuard } from "@/lib/workflow/stage-policy";
import { recordWorkflowEvent, WORKFLOW_EVENT_TYPES } from "@/features/event-system";

type Ctx = { params: Promise<{ dealId: string }> };

function parseMeta(raw: Prisma.JsonValue | null): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

export async function PATCH(req: Request, ctx: Ctx) {
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
      return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
    }

    const denied = await forbidUnlessDealAccess(user, P.DEALS_STAGE_CHANGE, {
      ownerId: deal.ownerId,
    });
    if (denied) return denied;

    const userId = user.id;

    const nextStage = await prisma.pipelineStage.findFirst({
      where: { id: body.stageId, pipelineId: deal.pipelineId },
    });
    if (!nextStage) {
      return NextResponse.json(
        { error: "Стадія не знайдена у цій воронці" },
        { status: 400 },
      );
    }

    if (deal.stageId === nextStage.id) {
      return NextResponse.json({ ok: true, stageId: nextStage.id });
    }

    const isForward = nextStage.sortOrder > deal.stage.sortOrder;
    if (isForward && nextStage.sortOrder !== deal.stage.sortOrder + 1) {
      return NextResponse.json(
        {
          error: "Дозволено перехід лише на наступний етап.",
        },
        { status: 400 },
      );
    }

    if (isForward) {
      const paymentIncome = await prisma.moneyTransaction.aggregate({
        where: { dealId, type: "INCOME", status: "PAID" },
        _sum: { amount: true },
      });
      const paid = Number(paymentIncome._sum.amount ?? 0);
      const total = Number(deal.value ?? 0);
      const percentPaid = total > 0 ? (paid / total) * 100 : 0;

      const meta = parseMeta(deal.workspaceMeta);
      const proposalSent = meta.proposalSent === true;
      const executionChecklist =
        meta.executionChecklist &&
        typeof meta.executionChecklist === "object" &&
        !Array.isArray(meta.executionChecklist)
          ? (meta.executionChecklist as Record<string, unknown>)
          : {};

      const validation = canMoveToNextStage({
        currentStageName: deal.stage.name,
        currentStageSlug: deal.stage.slug,
        hasEstimate: deal._count.estimates > 0,
        hasQuote: proposalSent,
        quoteApproved: executionChecklist.estimateApproved === true,
        contractSigned: deal.contract?.status === "FULLY_SIGNED",
        payment70Done: percentPaid >= 70,
        procurementCreated: deal._count.dealPurchaseOrders > 0,
        productionStarted: Boolean(deal.productionFlow),
      });
      const guard = evaluateDealStageTransitionGuard({
        currentStageSlug: deal.stage.slug,
        nextStageSlug: nextStage.slug,
        hasEstimate: deal._count.estimates > 0,
        hasQuote: proposalSent,
        contractSigned: deal.contract?.status === "FULLY_SIGNED",
        payment70Done: percentPaid >= 70,
        productionStarted: Boolean(deal.productionFlow),
      });

      if (!validation.ok || !guard.ok) {
        return NextResponse.json(
          {
            error: "Перехід заблоковано Flow Engine.",
            checklist: validation.checklist,
            blockers: [
              ...validation.blockers,
              ...guard.blockers.map((x) => ({ id: x.code, label: x.message })),
            ],
            stage: validation.stage,
            nextStage: validation.nextStage,
          },
          { status: 409 },
        );
      }
    }

    await prisma.$transaction([
      prisma.deal.update({
        where: { id: dealId },
        data: { stageId: nextStage.id },
      }),
      prisma.dealStageHistory.create({
        data: {
          dealId,
          fromStageId: deal.stageId,
          toStageId: nextStage.id,
          changedById: userId,
        },
      }),
    ]);

    await appendActivityLog({
      entityType: "DEAL",
      entityId: dealId,
      type: "DEAL_STAGE_CHANGED",
      actorUserId: userId,
      data: { toStageId: nextStage.id, toStageName: nextStage.name },
    });
    await publishCrmEvent({
      type: CRM_EVENT_TYPES.STAGE_CHANGED,
      dealId,
      payload: {
        fromStageId: deal.stageId,
        toStageId: nextStage.id,
        toStageName: nextStage.name,
      },
      dedupeKey: `stage:${dealId}:${deal.stageId}:${nextStage.id}:${Date.now()}`,
    });
    if (nextStage.slug.toLowerCase().includes("production")) {
      await recordWorkflowEvent(
        WORKFLOW_EVENT_TYPES.PRODUCTION_TRANSFERRED,
        { dealId },
        {
          entityType: "DEAL",
          entityId: dealId,
          dealId,
          userId,
          dedupeKey: `production-transferred:${dealId}:${nextStage.id}`,
        },
      );
    }

    revalidatePath(`/deals/${dealId}/workspace`);
    return NextResponse.json({
      ok: true,
      stageId: nextStage.id,
      stageName: nextStage.name,
    });
  } catch (e) {
     
    console.error("[PATCH deal stage]", e);
    return NextResponse.json({ error: "Помилка збереження" }, { status: 500 });
  }
}
