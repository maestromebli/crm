import { prisma } from "../../lib/prisma";
import { Prisma } from "@prisma/client";
import type { DealContractStatus } from "@prisma/client";
import { loadDealPaymentMilestonesForWorkspace } from "../../lib/deals/deal-payment-milestone-load";
import { logPrismaError, userFacingPrismaMessage } from "../../lib/prisma-errors";
import type { AccessContext } from "../../lib/authz/data-scope";
import { canAccessOwner, ownerIdWhere } from "../../lib/authz/data-scope";
import { evaluateReadiness, allReadinessMet } from "./readiness";
import type { DealWorkspaceMeta, DealWorkspacePayload } from "../../lib/deal-core/workspace-types";
import { parseDealCommercialSnapshot } from "../../lib/deals/commercial-snapshot";
import { parseDealControlMeasurement } from "../../lib/deals/control-measurement";
import { parseHandoffManifest } from "../../lib/deals/document-templates";
import {
  dealConstructorRoomApiSelect,
  type PrismaRoomRow,
  mapPrismaConstructorRoomToWorkspacePayload,
} from "../../lib/constructor-room/workspace-room-map";
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

function isMissingTableError(error: unknown, tableName: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021" &&
    error.message.includes(tableName)
  );
}

function isMissingColumnError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2022"
  );
}

async function ensureDealHandoff(dealId: string) {
  const existing = await prisma.dealHandoff.findUnique({
    where: { dealId },
  });
  if (existing) return existing;

  try {
    return await prisma.dealHandoff.create({
      data: { dealId },
    });
  } catch (error) {
    // Конкурентний create для того ж dealId: повертаємо вже створений запис.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const row = await prisma.dealHandoff.findUnique({
        where: { dealId },
      });
      if (row) return row;
    }
    throw error;
  }
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
          value: d.value != null ? Number(d.value) : null,
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

/** Стадії воронки DEAL для канбану — усі колонки, навіть без угод. */
export type DealBoardStage = {
  id: string;
  name: string;
  sortOrder: number;
  pipelineId: string;
  pipelineName: string;
};

/**
 * Усі стадії для пайплайнів, присутніх у рядках; якщо рядків немає — дефолтна воронка DEAL.
 */
export async function listDealBoardStages(
  dealRows: Array<{ pipelineId: string }>,
): Promise<DealBoardStage[]> {
  if (!process.env.DATABASE_URL?.trim()) return [];
  try {
    let pipelineIds = [...new Set(dealRows.map((r) => r.pipelineId))];
    if (pipelineIds.length === 0) {
      const fallback = await prisma.pipeline.findFirst({
        where: { entityType: "DEAL" },
        orderBy: [{ isDefault: "desc" }, { id: "asc" }],
      });
      if (fallback) pipelineIds = [fallback.id];
    }
    if (pipelineIds.length === 0) return [];
    const pipelines = await prisma.pipeline.findMany({
      where: { id: { in: pipelineIds } },
      include: { stages: { orderBy: { sortOrder: "asc" } } },
      orderBy: { id: "asc" },
    });
    const out: DealBoardStage[] = [];
    for (const p of pipelines) {
      for (const s of p.stages) {
        out.push({
          id: s.id,
          name: s.name,
          sortOrder: s.sortOrder,
          pipelineId: p.id,
          pipelineName: p.name,
        });
      }
    }
    return out;
  } catch (e) {
    logPrismaError("listDealBoardStages", e);
    return [];
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
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        pipelineId: true,
        stageId: true,
        leadId: true,
        clientId: true,
        primaryContactId: true,
        ownerId: true,
        productionManagerId: true,
        installationDate: true,
        expectedCloseDate: true,
        value: true,
        currency: true,
        workspaceMeta: true,
        controlMeasurementJson: true,
        commercialSnapshotJson: true,
        createdAt: true,
        updatedAt: true,
        client: true,
        primaryContact: true,
        owner: { select: { id: true, name: true, email: true } },
        productionManager: {
          select: { id: true, name: true, email: true },
        },
        pipeline: true,
        stage: true,
      },
    });
    if (!deal) return null;
    if (!canAccessOwner(ctx, deal.ownerId)) return null;

    const constructorRoomSelect = dealConstructorRoomApiSelect();
    const { messages: _ignoredMessages, ...constructorRoomSelectWithoutMessages } =
      constructorRoomSelect;
    let constructorRoom: PrismaRoomRow | null = null;
    try {
      constructorRoom = await prisma.dealConstructorRoom.findUnique({
        where: { dealId: deal.id },
        select: constructorRoomSelect,
      });
    } catch (e) {
      if (!isMissingTableError(e, "DealConstructorRoomMessage")) {
        throw e;
      }
      const roomWithoutMessages = await prisma.dealConstructorRoom.findUnique({
        where: { dealId: deal.id },
        select: constructorRoomSelectWithoutMessages,
      });
      constructorRoom = roomWithoutMessages
        ? { ...roomWithoutMessages, messages: [] }
        : null;
    }

    const paymentMilestoneRows =
      await loadDealPaymentMilestonesForWorkspace(deal.id);

    const stages = await prisma.pipelineStage.findMany({
      where: { pipelineId: deal.pipelineId },
      orderBy: { sortOrder: "asc" },
    });

    const now = new Date();
    let flow:
      | {
          id: string;
          status: string;
          createdAt: Date;
          acceptedAt: Date | null;
          number: string;
        }
      | null = null;
    try {
      flow = await prisma.productionFlow.findUnique({
        where: { dealId: deal.id },
        select: {
          id: true,
          status: true,
          createdAt: true,
          acceptedAt: true,
          number: true,
        },
      });
    } catch (e) {
      if (!isMissingTableError(e, "ProductionFlow") && !isMissingColumnError(e)) {
        throw e;
      }
      flow = null;
    }

    let contractRow:
      | ({
          status: DealContractStatus;
          templateKey: string | null;
          version: number;
          updatedAt: Date;
          signedPdfUrl: string | null;
          diiaSessionId: string | null;
          versions: Array<{
            id: string;
            revision: number;
            createdAt: Date;
            createdById: string | null;
            lifecycleStatus: DealContractStatus;
            templateKey: string | null;
          }>;
        } & Record<string, unknown>)
      | null = null;
    try {
      contractRow = await prisma.dealContract.findUnique({
        where: { dealId: deal.id },
        include: {
          versions: {
            orderBy: { revision: "desc" },
            take: 24,
            select: {
              id: true,
              revision: true,
              createdAt: true,
              createdById: true,
              lifecycleStatus: true,
              templateKey: true,
            },
          },
        },
      });
    } catch (e) {
      if (!isMissingTableError(e, "DealContract") && !isMissingColumnError(e)) {
        throw e;
      }
      contractRow = null;
    }

    const [
      attachmentRows,
      handoffRow,
      lastEval,
      estimatesCount,
      openTasksCount,
      overdueOpenTasksCount,
      completedTasksCount,
      lastActivityRow,
      latestEstimate,
      linkedProjects,
      conversionAudit,
    ] = await Promise.all([
      prisma.attachment.findMany({
        where: {
          entityType: "DEAL",
          entityId: deal.id,
          deletedAt: null,
        },
        select: {
          id: true,
          fileAssetId: true,
          fileName: true,
          fileUrl: true,
          category: true,
          version: true,
          isCurrentVersion: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      ensureDealHandoff(deal.id),
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
      prisma.project.findMany({
        where: { dealId: deal.id },
        select: { id: true, code: true, title: true, status: true },
      }),
      deal.leadId
        ? prisma.leadConversionAudit.findUnique({
            where: { leadId: deal.leadId },
            select: {
              migratedFilesCount: true,
              migratedContactsCount: true,
              activeEstimateIdUsed: true,
              checklistSnapshot: true,
              warningsAtConversion: true,
            },
          })
        : Promise.resolve(null),
    ]);

    const attachmentsByCategory: Record<string, number> = {};
    for (const a of attachmentRows) {
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
      contractStatus: contractRow?.status ?? null,
      attachmentsByCategory,
    });

    const manifest = parseHandoffManifest(handoffRow.manifestJson);
    const productionLaunch: DealWorkspacePayload["productionLaunch"] = !flow
      ? {
          status:
            meta.productionLaunched || meta.productionOrderCreated
              ? "LAUNCHED"
              : "NOT_READY",
          queuedAt: null,
          launchedAt: null,
          failedAt: null,
          error: null,
          productionOrderId: null,
        }
      : {
          status: "LAUNCHED",
          queuedAt: flow.createdAt.toISOString(),
          launchedAt:
            flow.acceptedAt?.toISOString() ?? flow.createdAt.toISOString(),
          failedAt: null,
          error: null,
          productionOrderId: flow.id,
        };

    const payload: DealWorkspacePayload = {
      deal: {
        id: deal.id,
        title: deal.title,
        description: deal.description,
        status: deal.status,
        value: deal.value != null ? Number(deal.value) : null,
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
      leadConversionSummary: conversionAudit
        ? {
            filesMigrated: conversionAudit.migratedFilesCount ?? 0,
            contactsLinked: conversionAudit.migratedContactsCount ?? 0,
            estimatesMoved:
              (
                conversionAudit.warningsAtConversion as {
                  migrationResult?: { estimatesMoved?: number };
                } | null
              )?.migrationResult?.estimatesMoved ??
              (conversionAudit.activeEstimateIdUsed ? 1 : 0),
            communicationMode:
              (
                conversionAudit.checklistSnapshot as {
                  communication?: { mode?: "full" | "recent" };
                } | null
              )?.communication?.mode === "recent"
                ? "recent"
                : "full",
          }
        : null,
      leadMessagesPreview: leadMessagesPreview.map((m) => ({
        id: m.id,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
        interactionKind: m.interactionKind,
      })),
      meta,
      commercialSnapshot: parseDealCommercialSnapshot(
        deal.commercialSnapshotJson,
      ),
      paymentMilestones: paymentMilestoneRows.map((m) => ({
        id: m.id,
        sortOrder: m.sortOrder,
        label: m.label,
        amount: m.amount != null ? Number(m.amount) : null,
        currency: m.currency,
        dueAt: m.dueAt?.toISOString() ?? null,
        confirmedAt: m.confirmedAt?.toISOString() ?? null,
      })),
      controlMeasurement: parseDealControlMeasurement(
        deal.controlMeasurementJson,
      ),
      contract: contractRow
        ? {
            status: contractRow.status,
            templateKey: contractRow.templateKey,
            version: contractRow.version,
            updatedAt: contractRow.updatedAt.toISOString(),
            signedPdfUrl: contractRow.signedPdfUrl,
            diiaSessionId: contractRow.diiaSessionId,
            draft: null,
            versions: contractRow.versions.map((v) => ({
              id: v.id,
              revision: v.revision,
              createdAt: v.createdAt.toISOString(),
              createdById: v.createdById,
              lifecycleStatus: v.lifecycleStatus,
              documentType: "CONTRACT" as const,
              format: "HTML" as const,
              templateKey: v.templateKey,
              recipientType: "CLIENT_PERSON" as const,
            })),
          }
        : null,
      attachments: attachmentRows.map((a) => ({
        id: a.id,
        fileAssetId: a.fileAssetId,
        fileName: a.fileName,
        fileUrl: a.fileUrl,
        category: a.category,
        version: a.version,
        isCurrentVersion: a.isCurrentVersion,
        createdAt: a.createdAt.toISOString(),
      })),
      attachmentsCount: attachmentRows.length,
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
        manifest,
      },
      productionLaunch,
      constructorRoom: constructorRoom
        ? mapPrismaConstructorRoomToWorkspacePayload(constructorRoom)
        : null,
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
      linkedFinanceProjects: linkedProjects.map((p) => ({
        id: p.id,
        code: p.code ?? "",
        title: p.title ?? "",
        status: p.status ?? "",
      })),
      canManageFinanceProjectLink: false,
    };

    return payload;
  } catch (e) {
    logPrismaError("getDealWorkspacePayload", e);
    return null;
  }
}
