import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { loadEnverExecutionSignals } from "@/lib/enver/load-execution-signals";
import {
  evaluateCloseOrderGate,
  evaluateReadyForHandoffGate,
  evaluateReleaseToProductionGate,
} from "@/lib/enver/order-execution-policy";

type Ctx = { params: Promise<{ dealId: string }> };

function parseMeta(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

export async function GET(_req: Request, ctx: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { dealId } = await ctx.params;
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      id: true,
      ownerId: true,
      workspaceMeta: true,
      contract: { select: { status: true } },
      handoff: { select: { status: true, id: true } },
    },
  });
  if (!deal) {
    return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
  }

  const denied = await forbidUnlessDealAccess(user, P.DEALS_VIEW, {
    ownerId: deal.ownerId,
  });
  if (denied) return denied;

  const signals = await loadEnverExecutionSignals({
    prisma,
    dealId,
    meta: parseMeta(deal.workspaceMeta),
  });

  const [requiredChecklistCount, checkedRequiredCount, latestSnapshot, spec] =
    await Promise.all([
      deal.handoff?.id
        ? prisma.dealHandoffChecklistItem.count({
            where: { handoffId: deal.handoff.id, isRequired: true },
          })
        : Promise.resolve(0),
      deal.handoff?.id
        ? prisma.dealHandoffChecklistItem.count({
            where: {
              handoffId: deal.handoff.id,
              isRequired: true,
              isChecked: true,
            },
          })
        : Promise.resolve(0),
      prisma.orderFinancialSnapshot.findFirst({
        where: { dealId },
        orderBy: { snapshotDate: "desc" },
        select: {
          id: true,
          snapshotDate: true,
          plannedRevenue: true,
          actualRevenue: true,
          plannedCost: true,
          actualCost: true,
          plannedMargin: true,
          actualMargin: true,
          source: true,
          comment: true,
        },
      }),
      prisma.projectSpec.findFirst({
        where: { dealId },
        select: {
          id: true,
          status: true,
          currentVersionId: true,
          currentVersion: {
            select: {
              id: true,
              versionNo: true,
              status: true,
              approvalStage: true,
              approvedAt: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

  const readyForHandoffBlockers = evaluateReadyForHandoffGate({
    contractSigned: deal.contract?.status === "FULLY_SIGNED",
    hasExecutionSpec: signals.hasExecutionSpec,
    hasRequiredHandoffFiles: signals.hasRequiredHandoffFiles,
  });
  const releaseToProductionBlockers = evaluateReleaseToProductionGate({
    handoffAccepted: deal.handoff?.status === "ACCEPTED",
    handoffChecklistCompleted: signals.handoffChecklistCompleted,
    bomApproved: signals.bomApproved,
    criticalMaterialsReady: signals.criticalMaterialsReady,
  });
  const closeOrderBlockers = evaluateCloseOrderGate({
    deliveryAccepted: signals.deliveryAccepted,
    financeActualsPosted: signals.financeActualsPosted,
    productionDone: signals.productionDone,
  });

  return NextResponse.json({
    ok: true,
    data: {
      gates: {
        readyForHandoff: {
          ok: readyForHandoffBlockers.length === 0,
          blockers: readyForHandoffBlockers,
        },
        releaseToProduction: {
          ok: releaseToProductionBlockers.length === 0,
          blockers: releaseToProductionBlockers,
        },
        closeOrder: {
          ok: closeOrderBlockers.length === 0,
          blockers: closeOrderBlockers,
        },
      },
      signals,
      projectSpec: spec
        ? {
            id: spec.id,
            status: spec.status,
            currentVersionId: spec.currentVersionId,
            currentVersionNo: spec.currentVersion?.versionNo ?? null,
            currentVersionStatus: spec.currentVersion?.status ?? null,
            currentVersionApprovalStage:
              spec.currentVersion?.approvalStage ?? null,
            approvedAt: spec.currentVersion?.approvedAt?.toISOString() ?? null,
          }
        : null,
      handoffChecklist: {
        requiredCount: requiredChecklistCount,
        checkedRequiredCount,
        complete:
          requiredChecklistCount > 0 &&
          checkedRequiredCount >= requiredChecklistCount,
      },
      latestFinancialSnapshot: latestSnapshot
        ? {
            id: latestSnapshot.id,
            snapshotDate: latestSnapshot.snapshotDate.toISOString(),
            plannedRevenue: Number(latestSnapshot.plannedRevenue),
            actualRevenue: Number(latestSnapshot.actualRevenue),
            plannedCost: Number(latestSnapshot.plannedCost),
            actualCost: Number(latestSnapshot.actualCost),
            plannedMargin:
              latestSnapshot.plannedMargin != null
                ? Number(latestSnapshot.plannedMargin)
                : null,
            actualMargin:
              latestSnapshot.actualMargin != null
                ? Number(latestSnapshot.actualMargin)
                : null,
            source: latestSnapshot.source,
            comment: latestSnapshot.comment,
          }
        : null,
    },
  });
}
