import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { calculateEstimateTotalsFromLines } from "@/features/estimate-core";
import { mergeWorkspaceMeta } from "@/lib/deal-api/workspace-meta-merge";
import {
  isStageTransitionFailure,
  transitionDealStage,
} from "@/lib/deals/stage-transition";
import { canFinanceAction } from "@/features/finance/lib/permissions";
import type { EstimateCoreTotalsDto } from "@/features/finance/types/estimate-core-dto";
import { getRequestContext, writePlatformAudit } from "@/lib/platform";
import { logError, logInfo } from "@/lib/observability/logger";
import { recordWorkflowEvent, WORKFLOW_EVENT_TYPES } from "@/features/event-system";
import type { Prisma } from "@prisma/client";

type Ctx = { params: Promise<{ dealId: string }> };

type StepStatus = "success" | "failed" | "skipped";
type StepKey =
  | "recalc_estimate"
  | "sync_deal_value"
  | "create_doc"
  | "advance_stage"
  | "notify";

type StepResult = {
  key: StepKey;
  status: StepStatus;
  message: string;
  details?: Record<string, unknown>;
};

export async function POST(req: Request, ctx: Ctx) {
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
  const steps: StepResult[] = [];

  try {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: {
        id: true,
        ownerId: true,
        pipelineId: true,
        stage: { select: { id: true, sortOrder: true } },
        value: true,
        workspaceMeta: true,
      },
    });
    if (!deal) {
      return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
    }

    const denied = await forbidUnlessDealAccess(user, P.DEALS_UPDATE, {
      ownerId: deal.ownerId,
    });
    if (denied) return denied;
    if (!canFinanceAction(user, "finance.transaction.create")) {
      return NextResponse.json(
        { error: "Недостатньо прав для фінансового one-click сценарію" },
        { status: 403 },
      );
    }

    let latestEstimateTotal: number | null = null;
    let latestEstimateVersion: number | null = null;

    // Step 1: recalculate latest estimate
    try {
      const latestEstimate = await prisma.estimate.findFirst({
        where: { dealId },
        orderBy: { version: "desc" },
        include: { lineItems: true },
      });
      if (!latestEstimate) {
        steps.push({
          key: "recalc_estimate",
          status: "skipped",
          message: "Немає смети для перерахунку",
        });
      } else {
        const totals: EstimateCoreTotalsDto = calculateEstimateTotalsFromLines(
          latestEstimate.lineItems.map((line) => ({
            amountSale: line.amountSale,
            amountCost: line.amountCost,
          })),
          Number(latestEstimate.discountAmount ?? 0),
          Number(latestEstimate.deliveryCost ?? 0),
          Number(latestEstimate.installationCost ?? 0),
        );
        await prisma.estimate.update({
          where: { id: latestEstimate.id },
          data: {
            totalPrice: totals.totalPrice,
            totalCost: totals.totalCost,
            grossMargin: totals.grossMargin,
          },
        });
        latestEstimateTotal = totals.totalPrice;
        latestEstimateVersion = latestEstimate.version;
        steps.push({
          key: "recalc_estimate",
          status: "success",
          message: "Смету перераховано",
          details: {
            estimateId: latestEstimate.id,
            estimateVersion: latestEstimate.version,
            totalPrice: totals.totalPrice,
          },
        });
      }
    } catch (error) {
      steps.push({
        key: "recalc_estimate",
        status: "failed",
        message: "Не вдалося перерахувати смету",
        details: { error: error instanceof Error ? error.message : String(error) },
      });
    }

    // Step 2: sync deal value from estimate total
    try {
      if (latestEstimateTotal == null) {
        steps.push({
          key: "sync_deal_value",
          status: "skipped",
          message: "Синхронізація пропущена: немає актуальної суми смети",
        });
      } else if (Number(deal.value ?? 0) === Number(latestEstimateTotal)) {
        steps.push({
          key: "sync_deal_value",
          status: "skipped",
          message: "Сума угоди вже синхронізована",
        });
      } else {
        await prisma.deal.update({
          where: { id: dealId },
          data: { value: latestEstimateTotal },
        });
        steps.push({
          key: "sync_deal_value",
          status: "success",
          message: "Суму угоди синхронізовано зі сметою",
          details: {
            previousValue: deal.value,
            nextValue: latestEstimateTotal,
          },
        });
      }
    } catch (error) {
      steps.push({
        key: "sync_deal_value",
        status: "failed",
        message: "Не вдалося синхронізувати суму угоди",
        details: { error: error instanceof Error ? error.message : String(error) },
      });
    }

    // Step 3: create commercial doc marker (proposal prepared)
    try {
      if (latestEstimateTotal == null) {
        steps.push({
          key: "create_doc",
          status: "skipped",
          message: "Підготовка КП пропущена: немає смети",
        });
      } else {
        const autoNote = [
          "Авто one-click фінансовий сценарій",
          latestEstimateVersion != null ? `v${latestEstimateVersion}` : null,
          `сума ${latestEstimateTotal.toLocaleString("uk-UA")} грн`,
          new Date().toLocaleString("uk-UA"),
        ]
          .filter(Boolean)
          .join(" · ");
        const nextMeta = mergeWorkspaceMeta(deal.workspaceMeta, {
          proposalSent: true,
          proposalNotes: autoNote,
        });
        await prisma.deal.update({
          where: { id: dealId },
          data: { workspaceMeta: nextMeta },
        });
        steps.push({
          key: "create_doc",
          status: "success",
          message: "КП позначено як підготовлене",
          details: { proposalNotes: autoNote },
        });
      }
    } catch (error) {
      steps.push({
        key: "create_doc",
        status: "failed",
        message: "Не вдалося підготувати КП",
        details: { error: error instanceof Error ? error.message : String(error) },
      });
    }

    // Step 4: move to next stage
    try {
      const next = await prisma.pipelineStage.findFirst({
        where: {
          pipelineId: deal.pipelineId,
          sortOrder: deal.stage.sortOrder + 1,
        },
        select: { id: true },
      });
      if (!next) {
        steps.push({
          key: "advance_stage",
          status: "skipped",
          message: "Угода вже на фінальному етапі",
        });
      } else {
        const transition = await transitionDealStage({
          dealId,
          stageId: next.id,
          changedById: user.id,
        });
        if (isStageTransitionFailure(transition)) {
          steps.push({
            key: "advance_stage",
            status: "failed",
            message: transition.error,
            details: {
              blockers: transition.blockers,
              checklist: transition.checklist,
            },
          });
        } else if (!transition.changed) {
          steps.push({
            key: "advance_stage",
            status: "skipped",
            message: "Етап вже актуальний",
          });
        } else {
          steps.push({
            key: "advance_stage",
            status: "success",
            message: `Етап змінено на «${transition.toStageName}»`,
            details: { stageId: transition.toStageId },
          });
        }
      }
    } catch (error) {
      steps.push({
        key: "advance_stage",
        status: "failed",
        message: "Не вдалося змінити етап",
        details: { error: error instanceof Error ? error.message : String(error) },
      });
    }

    // Step 5: notify / emit workflow event
    const failedSteps = steps.filter((s) => s.status === "failed");
    try {
      const isSuccess = failedSteps.length === 0;
      const eventType = isSuccess
        ? WORKFLOW_EVENT_TYPES.FINANCIAL_WORKFLOW_COMPLETED
        : WORKFLOW_EVENT_TYPES.FINANCIAL_WORKFLOW_FAILED;
      await recordWorkflowEvent(
        eventType,
        {
          dealId,
          failedSteps: failedSteps.map((step) => step.key),
        },
        {
          entityType: "DEAL",
          entityId: dealId,
          dealId,
          userId: user.id,
          dedupeKey: `finance-one-click:${dealId}:${new Date().toISOString().slice(0, 16)}`,
        },
      );
      steps.push({
        key: "notify",
        status: "success",
        message: isSuccess
          ? "Нотифікацію про успішне виконання відправлено"
          : "Нотифікацію про часткове виконання відправлено",
      });
    } catch (error) {
      steps.push({
        key: "notify",
        status: "failed",
        message: "Не вдалося відправити нотифікацію",
        details: { error: error instanceof Error ? error.message : String(error) },
      });
    }

    const success = steps.filter((s) => s.status === "success").length;
    const failed = steps.filter((s) => s.status === "failed").length;
    const skipped = steps.filter((s) => s.status === "skipped").length;

    const auditData = JSON.parse(
      JSON.stringify({
        action: "financial_one_click_workflow",
        success,
        failed,
        skipped,
        steps,
      }),
    ) as Prisma.InputJsonValue;

    await writePlatformAudit({
      entityType: "DEAL",
      entityId: dealId,
      type: "DEAL_UPDATED",
      actorUserId: user.id,
      requestId: requestCtx.requestId,
      correlationId: requestCtx.correlationId,
      data: auditData,
    });

    revalidatePath(`/deals/${dealId}/workspace`);
    logInfo({
      module: "api.deals.financial-workflow",
      message: "Фінансовий сценарій виконано",
      requestId: requestCtx.requestId,
      correlationId: requestCtx.correlationId,
      details: { dealId, success, failed, skipped },
    });

    return NextResponse.json({
      ok: failed === 0,
      mode: "best-effort",
      summary: { success, failed, skipped },
      steps,
    });
  } catch (error) {
    logError({
      module: "api.deals.financial-workflow",
      message: "Не вдалося виконати фінансовий сценарій",
      requestId: requestCtx.requestId,
      correlationId: requestCtx.correlationId,
      details: { dealId, error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json(
      { error: "Помилка виконання one-click сценарію" },
      { status: 500 },
    );
  }
}
