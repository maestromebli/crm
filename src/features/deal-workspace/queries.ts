import { prisma } from "../../lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  logPrismaError,
  userFacingPrismaMessage,
} from "../../lib/prisma-errors";
import type { AccessContext } from "../../lib/authz/data-scope";
import { canAccessOwner, ownerIdWhere } from "../../lib/authz/data-scope";
import { evaluateReadiness, allReadinessMet } from "./readiness";
import type { DealWorkspaceMeta, DealWorkspacePayload } from "./types";
import { deriveDealListWarningBadge } from "./deal-workspace-warnings";

/** Фільтр списку угод (бокове меню / статичні маршрути). */
export type DealListViewId =
  | "all"
  | "pipeline"
  | "active"
  | "waiting_measure"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost"
  | "archived";

function dealWhereForListView(
  view: DealListViewId,
): Prisma.DealWhereInput {
  switch (view) {
    case "all":
    case "pipeline":
      return {};
    case "active":
      return { status: "OPEN" };
    case "waiting_measure":
      return { status: "OPEN", stage: { slug: "measurement" } };
    case "proposal":
      return { status: "OPEN", stage: { slug: "proposal" } };
    case "negotiation":
      return { status: "OPEN", stage: { slug: "contract" } };
    case "won":
      return { status: "WON" };
    case "lost":
      return { status: "LOST" };
    case "archived":
      return { status: "ON_HOLD" };
    default:
      return {};
  }
}

function parseMeta(raw: Prisma.JsonValue | null): DealWorkspaceMeta {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as DealWorkspaceMeta;
}

export async function listDealsForTable(
  ctx: AccessContext,
  options?: { view?: DealListViewId },
): Promise<{
  rows: Array<{
    id: string;
    title: string;
    stageId: string;
    stageName: string;
    stageSortOrder: number;
    pipelineId: string;
    pipelineName: string;
    ownerId: string;
    clientName: string;
    value: number | null;
    currency: string | null;
    ownerName: string | null;
    updatedAt: Date;
    nextStepLabel: string | null;
    nextActionAt: string | null;
    estimatesCount: number;
    warningBadge: "critical" | "warning" | null;
    paymentShort: string;
    status: string;
    hasContract: boolean;
  }>;
  error: string | null;
}> {
  if (!process.env.DATABASE_URL?.trim()) {
    return {
      rows: [],
      error:
        "Не задано `DATABASE_URL`. Додайте рядок у `.env.local` і перезапустіть `pnpm dev`.",
    };
  }
  try {
    const ownerIn = ownerIdWhere(ctx);
    const view: DealListViewId = options?.view ?? "all";
    const viewWhere = dealWhereForListView(view);
    const deals = await prisma.deal.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      where: {
        ...(ownerIn ? { ownerId: ownerIn } : {}),
        ...viewWhere,
      },
      include: {
        stage: true,
        pipeline: { select: { id: true, name: true } },
        client: true,
        owner: { select: { name: true, email: true } },
        contract: { select: { id: true } },
        _count: { select: { estimates: true } },
      },
    });
    return {
      rows: deals.map((d) => {
        const meta = parseMeta(d.workspaceMeta);
        const nextStepLabel = meta.nextStepLabel?.trim() ?? null;
        const nextActionAt = meta.nextActionAt ?? null;
        const pay = meta.payment?.milestones ?? [];
        const payDone = pay.filter((m) => m.done).length;
        const paymentShort =
          pay.length === 0
            ? "—"
            : payDone === pay.length
              ? `оплата ✓ ${pay.length}`
              : `${payDone}/${pay.length} віх`;
        return {
          id: d.id,
          title: d.title,
          stageId: d.stage.id,
          stageName: d.stage.name,
          stageSortOrder: d.stage.sortOrder,
          pipelineId: d.pipeline.id,
          pipelineName: d.pipeline.name,
          ownerId: d.ownerId,
          clientName: d.client.name,
          value: d.value,
          currency: d.currency,
          ownerName: d.owner.name ?? d.owner.email,
          updatedAt: d.updatedAt,
          nextStepLabel,
          nextActionAt,
          estimatesCount: d._count.estimates,
          warningBadge: deriveDealListWarningBadge({
            status: d.status,
            nextStepLabel,
            nextActionAt,
            updatedAt: d.updatedAt,
            estimatesCount: d._count.estimates,
          }),
          paymentShort,
          status: d.status,
          hasContract: Boolean(d.contract),
        };
      }),
      error: null,
    };
  } catch (e) {
    logPrismaError("listDealsForTable", e);
    return {
      rows: [],
      error: userFacingPrismaMessage(
        e,
        "Не вдалося завантажити угоди. Перевірте БД.",
      ),
    };
  }
}

export async function getDealWorkspacePayload(
  dealId: string,
  ctx: AccessContext,
): Promise<DealWorkspacePayload | null> {
  if (!process.env.DATABASE_URL?.trim()) return null;
  try {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        client: true,
        primaryContact: true,
        owner: { select: { id: true, name: true, email: true } },
        productionManager: {
          select: { id: true, name: true, email: true },
        },
        pipeline: true,
        stage: true,
        contract: true,
      },
    });
    if (!deal) return null;
    if (!canAccessOwner(ctx, deal.ownerId)) return null;

    const stages = await prisma.pipelineStage.findMany({
      where: { pipelineId: deal.pipelineId },
      orderBy: { sortOrder: "asc" },
    });

    const now = new Date();
    const [
      attachments,
      handoffRow,
      lastEval,
      estimatesCount,
      openTasksCount,
      overdueOpenTasksCount,
      completedTasksCount,
      lastActivityRow,
      latestEstimate,
    ] = await Promise.all([
      prisma.attachment.findMany({
        where: { entityType: "DEAL", entityId: deal.id },
        select: { category: true },
      }),
      prisma.dealHandoff.upsert({
        where: { dealId: deal.id },
        create: { dealId: deal.id },
        update: {},
      }),
      prisma.readinessEvaluation.findFirst({
        where: { dealId: deal.id },
        orderBy: { evaluatedAt: "desc" },
        select: { evaluatedAt: true },
      }),
      prisma.estimate.count({ where: { dealId: deal.id } }),
      prisma.task.count({
        where: {
          entityType: "DEAL",
          entityId: deal.id,
          status: { in: ["OPEN", "IN_PROGRESS"] },
        },
      }),
      prisma.task.count({
        where: {
          entityType: "DEAL",
          entityId: deal.id,
          status: { in: ["OPEN", "IN_PROGRESS"] },
          dueAt: { not: null, lt: now },
        },
      }),
      prisma.task.count({
        where: {
          entityType: "DEAL",
          entityId: deal.id,
          status: "DONE",
        },
      }),
      prisma.activityLog.findFirst({
        where: { entityType: "DEAL", entityId: deal.id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.estimate.findFirst({
        where: { dealId: deal.id },
        orderBy: { version: "desc" },
        select: {
          id: true,
          version: true,
          status: true,
          totalPrice: true,
        },
      }),
    ]);

    const attachmentsByCategory: Record<string, number> = {};
    for (const a of attachments) {
      const k = a.category;
      attachmentsByCategory[k] = (attachmentsByCategory[k] ?? 0) + 1;
    }

    const meta = parseMeta(deal.workspaceMeta);
    const conv = meta.conversion;
    const msgTake =
      conv?.communicationMode === "recent"
        ? Math.min(500, Math.max(1, conv.communicationRecentCount ?? 30))
        : 200;

    const leadMessagesPreview = deal.leadId
      ? (
          await prisma.leadMessage.findMany({
            where: { leadId: deal.leadId },
            orderBy: { createdAt: "desc" },
            take: msgTake,
            select: {
              id: true,
              body: true,
              createdAt: true,
              interactionKind: true,
            },
          })
        ).reverse()
      : [];

    const readiness = evaluateReadiness({
      meta,
      contractStatus: deal.contract?.status ?? null,
      attachmentsByCategory,
    });

    const payload: DealWorkspacePayload = {
      deal: {
        id: deal.id,
        title: deal.title,
        description: deal.description,
        status: deal.status,
        value: deal.value,
        currency: deal.currency,
        expectedCloseDate: deal.expectedCloseDate?.toISOString() ?? null,
        createdAt: deal.createdAt.toISOString(),
        updatedAt: deal.updatedAt.toISOString(),
      },
      client: {
        id: deal.client.id,
        name: deal.client.name,
        type: deal.client.type,
      },
      primaryContact: deal.primaryContact
        ? {
            id: deal.primaryContact.id,
            fullName: deal.primaryContact.fullName,
            phone: deal.primaryContact.phone,
            email: deal.primaryContact.email,
          }
        : null,
      owner: deal.owner,
      productionManager: deal.productionManager
        ? {
            id: deal.productionManager.id,
            name: deal.productionManager.name,
            email: deal.productionManager.email,
          }
        : null,
      installationDate: deal.installationDate?.toISOString() ?? null,
      pipeline: { id: deal.pipeline.id, name: deal.pipeline.name },
      stage: {
        id: deal.stage.id,
        name: deal.stage.name,
        slug: deal.stage.slug,
        sortOrder: deal.stage.sortOrder,
      },
      stages: stages.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        sortOrder: s.sortOrder,
      })),
      leadId: deal.leadId,
      leadMessagesPreview: leadMessagesPreview.map((m) => ({
        id: m.id,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
        interactionKind: m.interactionKind,
      })),
      meta,
      contract: deal.contract
        ? {
            status: deal.contract.status,
            templateKey: deal.contract.templateKey,
            version: deal.contract.version,
            signedPdfUrl: deal.contract.signedPdfUrl,
            diiaSessionId: deal.contract.diiaSessionId,
          }
        : null,
      attachmentsCount: attachments.length,
      attachmentsByCategory,
      readiness,
      readinessAllMet: allReadinessMet(readiness),
      lastReadinessSnapshotAt:
        lastEval?.evaluatedAt.toISOString() ?? null,
      handoff: {
        id: handoffRow.id,
        status: handoffRow.status,
        notes: handoffRow.notes,
        manifestJson: handoffRow.manifestJson,
        submittedAt: handoffRow.submittedAt?.toISOString() ?? null,
        acceptedAt: handoffRow.acceptedAt?.toISOString() ?? null,
        rejectedAt: handoffRow.rejectedAt?.toISOString() ?? null,
        rejectionReason: handoffRow.rejectionReason,
      },
      operationalStats: {
        estimatesCount,
        openTasksCount,
        overdueOpenTasksCount,
        completedTasksCount,
        lastActivityAt: lastActivityRow?.createdAt.toISOString() ?? null,
        latestEstimate: latestEstimate
          ? {
              id: latestEstimate.id,
              version: latestEstimate.version,
              status: latestEstimate.status,
              totalPrice: latestEstimate.totalPrice,
            }
          : null,
      },
    };

    return payload;
  } catch (e) {
    logPrismaError("getDealWorkspacePayload", e);
    return null;
  }
}
