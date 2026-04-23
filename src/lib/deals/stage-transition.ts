import { prisma } from "@/lib/prisma";
import { canMoveToNextStage } from "@/lib/deal-os/flow-engine";
import { evaluateDealStageTransitionGuard } from "@/lib/workflow/stage-policy";
import { loadEnverExecutionSignals } from "@/lib/enver/load-execution-signals";
import { syncProjectSpecFromDealMeta } from "@/lib/enver/sync-project-spec";
import { saveOrderFinancialSnapshotsByDeal } from "@/lib/finance/save-order-finance-snapshots";
import type { Prisma } from "@prisma/client";

type StageBlocker = { id: string; label: string };

export type StageTransitionResult =
  | {
      ok: true;
      changed: boolean;
      fromStageId: string;
      toStageId: string;
      toStageName: string;
      toStageSlug: string;
    }
  | {
      ok: false;
      status: 400 | 404 | 409;
      error: string;
      checklist?: unknown;
      blockers?: StageBlocker[];
      stage?: unknown;
      nextStage?: unknown;
    };

export type StageTransitionFailure = Extract<StageTransitionResult, { ok: false }>;

export function isStageTransitionFailure(
  result: StageTransitionResult,
): result is StageTransitionFailure {
  return result.ok === false;
}

function parseMeta(raw: Prisma.JsonValue | null): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

export async function transitionDealStage(args: {
  dealId: string;
  stageId: string;
  changedById: string;
}): Promise<StageTransitionResult> {
  const deal = await prisma.deal.findUnique({
    where: { id: args.dealId },
    select: {
      id: true,
      pipelineId: true,
      stageId: true,
      value: true,
      workspaceMeta: true,
      stage: { select: { id: true, name: true, slug: true, sortOrder: true } },
      contract: { select: { status: true } },
      handoff: { select: { status: true } },
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
    return { ok: false, status: 404, error: "Замовлення не знайдено" };
  }

  const nextStage = await prisma.pipelineStage.findFirst({
    where: { id: args.stageId, pipelineId: deal.pipelineId },
  });
  if (!nextStage) {
    return {
      ok: false,
      status: 400,
      error: "Стадія не знайдена у цій воронці",
    };
  }

  if (deal.stageId === nextStage.id) {
    return {
      ok: true,
      changed: false,
      fromStageId: deal.stageId,
      toStageId: nextStage.id,
      toStageName: nextStage.name,
      toStageSlug: nextStage.slug,
    };
  }

  const isForward = nextStage.sortOrder > deal.stage.sortOrder;
  if (isForward && nextStage.sortOrder !== deal.stage.sortOrder + 1) {
    return {
      ok: false,
      status: 400,
      error: "Дозволено перехід лише на наступний етап.",
    };
  }

  if (isForward) {
    const paymentIncome = await prisma.moneyTransaction.aggregate({
      where: { dealId: args.dealId, type: "INCOME", status: "PAID" },
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
    const enverSignals = await loadEnverExecutionSignals({
      prisma,
      dealId: args.dealId,
      meta,
    });

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
      hasExecutionSpec: enverSignals.hasExecutionSpec,
      hasRequiredHandoffFiles: enverSignals.hasRequiredHandoffFiles,
      handoffAccepted: deal.handoff?.status === "ACCEPTED",
      handoffChecklistCompleted: enverSignals.handoffChecklistCompleted,
      bomApproved: enverSignals.bomApproved,
      criticalMaterialsReady: enverSignals.criticalMaterialsReady,
      deliveryAccepted: enverSignals.deliveryAccepted,
      financeActualsPosted: enverSignals.financeActualsPosted,
      productionDone: enverSignals.productionDone,
    });

    if (!validation.ok || !guard.ok) {
      const normalizedValidationBlockers: StageBlocker[] = validation.blockers.map(
        (blocker, idx) => {
          return {
            id: `flow-${idx + 1}`,
            label: blocker,
          };
        },
      );

      return {
        ok: false,
        status: 409,
        error: "Перехід заблоковано Flow Engine.",
        checklist: validation.checklist,
        blockers: [
          ...normalizedValidationBlockers,
          ...guard.blockers.map((x) => ({ id: x.code, label: x.message })),
        ],
        stage: validation.stage,
        nextStage: validation.nextStage,
      };
    }
  }

  await prisma.$transaction([
    prisma.deal.update({
      where: { id: args.dealId },
      data: { stageId: nextStage.id },
    }),
    prisma.dealStageHistory.create({
      data: {
        dealId: args.dealId,
        fromStageId: deal.stageId,
        toStageId: nextStage.id,
        changedById: args.changedById,
      },
    }),
  ]);

  if (isForward) {
    try {
      await syncProjectSpecFromDealMeta({
        dealId: args.dealId,
        actorUserId: args.changedById,
      });
    } catch (error) {
      console.error("[stage-transition] project-spec sync failed", {
        dealId: args.dealId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    try {
      await saveOrderFinancialSnapshotsByDeal({
        dealId: args.dealId,
        source: "stage_transition",
        actorUserId: args.changedById,
        comment: `Автознімок ENVER при переході на стадію ${nextStage.slug}.`,
        meta: {
          fromStageId: deal.stageId,
          toStageId: nextStage.id,
          toStageSlug: nextStage.slug,
        },
      });
    } catch (error) {
      console.error("[stage-transition] order snapshot failed", {
        dealId: args.dealId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    ok: true,
    changed: true,
    fromStageId: deal.stageId,
    toStageId: nextStage.id,
    toStageName: nextStage.name,
    toStageSlug: nextStage.slug,
  };
}
