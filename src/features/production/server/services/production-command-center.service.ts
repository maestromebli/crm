import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ProductionCommandCenterView } from "../../types/production";
import { getDemoCommandCenterView } from "../demo/production-demo";
import { normalizeMaterialsChecklist } from "../../workshop-materials";
import { WORKSHOP_KANBAN_COLUMNS, WORKSHOP_STATION_LABEL_BY_KEY } from "../../workshop-stages";

/** БД без застосованих міграцій виробництва (немає таблиць ProductionRisk тощо). */
function isProductionSchemaMissingError(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2021") return true;
    if (e.code === "P2010" && typeof e.meta?.message === "string" && e.meta.message.includes("does not exist")) {
      return true;
    }
  }
  const msg = e instanceof Error ? e.message : String(e);
  return /does not exist/i.test(msg) && /productionrisk|production_flow|\"public\"\./i.test(msg);
}

const STATION_LABELS = WORKSHOP_STATION_LABEL_BY_KEY;

export async function getProductionCommandCenterView(): Promise<ProductionCommandCenterView> {
  const productionFlowDelegate = (
    prisma as unknown as {
      productionFlow?: {
        findMany: (args: unknown) => Promise<
          Array<{
            id: string;
            number: string;
            title: string;
            clientName: string;
            currentStepKey: string;
            status: string;
            readinessPercent: number;
            riskScore: number;
            dueDate: Date | null;
            blockersCount: number;
            openQuestionsCount: number;
            risks: Array<{ severity: string; title: string; description: string }>;
            aiInsights: Array<{ recommendedAction: string | null }>;
            stationLoads: Array<{
              stationKey: string;
              stationLabel: string;
              loadPercent: number;
            }>;
            updatedAt: Date;
          }>
        >;
      };
    }
  ).productionFlow;

  // Graceful fallback when the running server still has stale Prisma client delegates.
  if (!productionFlowDelegate) {
    return getDemoCommandCenterView();
  }

  try {
    return await loadCommandCenterFromDatabase(productionFlowDelegate);
  } catch (e) {
    if (isProductionSchemaMissingError(e)) {
      return getDemoCommandCenterView();
    }
    throw e;
  }
}

async function loadCommandCenterFromDatabase(
  productionFlowDelegate: NonNullable<
    (typeof prisma)["productionFlow"] extends infer T ? T : never
  >,
): Promise<ProductionCommandCenterView> {
  const flows = await productionFlowDelegate.findMany({
    where: { status: { not: "CANCELLED" } },
    orderBy: [{ riskScore: "desc" }, { updatedAt: "desc" }],
    include: {
      risks: {
        where: { resolvedAt: null },
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        take: 3,
      },
      aiInsights: { orderBy: { createdAt: "desc" }, take: 3 },
      stationLoads: true,
    },
    take: 200,
  });
  if (flows.length === 0) {
    return getDemoCommandCenterView();
  }

  const tasks = await prisma.productionTask.findMany({
    where: { status: { not: "CANCELLED" } },
    include: {
      flow: {
        select: { id: true, number: true, title: true, dueDate: true, priority: true },
      },
      assigneeUser: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 600,
  });

  const now = Date.now();
  const activeFlows = flows.filter((f) => ["NEW", "ACTIVE", "BLOCKED", "ON_HOLD"].includes(f.status));
  const blockedFlows = flows.filter((f) => f.status === "BLOCKED");
  const highRiskFlows = flows.filter((f) => f.riskScore >= 70);
  const overdueFlows = flows.filter((f) => f.dueDate && f.dueDate.getTime() < now);
  const readyToDistribute = flows.filter((f) => f.currentStepKey === "TASKS_DISTRIBUTED").length;
  const averageReadiness =
    flows.length > 0
      ? Math.round(flows.reduce((sum, flow) => sum + flow.readinessPercent, 0) / flows.length)
      : 0;

  const stationMap = new Map<string, { stationKey: string; stationLabel: string; loadPercent: number }>();
  for (const flow of flows) {
    for (const station of flow.stationLoads) {
      const prev = stationMap.get(station.stationKey);
      if (!prev || station.loadPercent > prev.loadPercent) {
        stationMap.set(station.stationKey, {
          stationKey: station.stationKey,
          stationLabel: station.stationLabel || STATION_LABELS[station.stationKey] || station.stationKey,
          loadPercent: station.loadPercent,
        });
      }
    }
  }

  const queue = activeFlows.map((flow) => ({
    id: flow.id,
    number: flow.number,
    clientName: flow.clientName,
    title: flow.title,
    currentStepKey: flow.currentStepKey,
    status: flow.status,
    readinessPercent: flow.readinessPercent,
    riskScore: flow.riskScore,
    dueDate: flow.dueDate?.toISOString() ?? null,
    blockersCount: flow.blockersCount,
    openQuestionsCount: flow.openQuestionsCount,
  }));

  const criticalBlockers = flows
    .flatMap((flow) =>
      flow.risks
        .filter((risk) => risk.severity === "CRITICAL" || risk.severity === "HIGH")
        .map((risk) => ({
          flowId: flow.id,
          number: flow.number,
          title: flow.title,
          severity: risk.severity,
          message: risk.title,
        })),
    )
    .slice(0, 10);

  const nextActions = flows.slice(0, 10).map((flow) => {
    const topRisk = flow.risks[0];
    const topInsight = flow.aiInsights[0];
    const description =
      topInsight?.recommendedAction ??
      topRisk?.description ??
      `Поточний крок: ${flow.currentStepKey}. Оновіть потік згідно етапу.`;
    return {
      flowId: flow.id,
      number: flow.number,
      title: flow.title,
      description,
      ctaLabel: "Відкрити штаб",
    };
  });

  const procurement = tasks
    .filter((task) => task.type === "PROCUREMENT")
    .slice(0, 30)
    .map((task) => {
      const meta = (task.metadataJson ?? {}) as {
        supplier?: string;
        expectedDate?: string;
        receivedDate?: string;
      };
      const status: "EXPECTED" | "ORDERED" | "DELIVERED" =
        task.status === "DONE" ? "DELIVERED" : task.status === "IN_PROGRESS" ? "ORDERED" : "EXPECTED";
      return {
        id: task.id,
        flowId: task.flowId,
        flowNumber: task.flow.number,
        title: task.title,
        status,
        supplier: meta.supplier ?? null,
        expectedDate: meta.expectedDate ?? task.dueDate?.toISOString() ?? null,
        receivedDate: status === "DELIVERED" ? task.updatedAt.toISOString() : (meta.receivedDate ?? null),
      };
    });

  const warehouse = tasks
    .filter((task) => task.type === "PROCUREMENT" && task.status === "DONE")
    .slice(0, 30)
    .map((task) => ({
      flowId: task.flowId,
      flowNumber: task.flow.number,
      material: task.title,
      reserved: true,
      incoming: false,
    }));

  const workshopKanban = WORKSHOP_KANBAN_COLUMNS.map((stage) => {
    const stageTasks = tasks
      .filter((task) => {
        if (task.type !== "WORKSHOP") return false;
        const meta = (task.metadataJson ?? {}) as { workshopStage?: string };
        return (meta.workshopStage ?? "CUTTING") === stage.key;
      })
      .slice(0, 50)
      .map((task) => {
        const meta = (task.metadataJson ?? {}) as { materialsChecklist?: unknown };
        const materialsChecklist = normalizeMaterialsChecklist(meta.materialsChecklist);
        const assignee = task.assigneeUser;
        const assigneeName = assignee
          ? (assignee.name?.trim() || assignee.email?.trim() || null)
          : null;
        return {
          id: task.id,
          flowId: task.flowId,
          flowNumber: task.flow.number,
          title: task.title,
          priority: task.flow.priority,
          dueDate: task.dueDate?.toISOString() ?? task.flow.dueDate?.toISOString() ?? null,
          assigneeUserId: task.assigneeUserId ?? null,
          assigneeName,
          materialsChecklist,
        };
      });
    return {
      stageKey: stage.key,
      stageLabel: stage.label,
      tasks: stageTasks,
    };
  });

  const installation = tasks
    .filter((task) => task.type === "INSTALLATION")
    .slice(0, 30)
    .map((task) => {
      const meta = (task.metadataJson ?? {}) as { address?: string; team?: string };
      const status: "PLANNED" | "IN_PROGRESS" | "DONE" =
        task.status === "DONE" ? "DONE" : task.status === "IN_PROGRESS" ? "IN_PROGRESS" : "PLANNED";
      return {
        id: task.id,
        flowId: task.flowId,
        flowNumber: task.flow.number,
        title: task.title,
        address: meta.address ?? null,
        date: task.dueDate?.toISOString() ?? null,
        team: meta.team ?? null,
        status,
      };
    });

  return {
    kpis: {
      activeFlows: activeFlows.length,
      blockedFlows: blockedFlows.length,
      averageReadiness,
      highRiskFlows: highRiskFlows.length,
      overdueFlows: overdueFlows.length,
      readyToDistribute,
    },
    queue,
    stationLoads: Array.from(stationMap.values()),
    criticalBlockers,
    nextActions,
    procurement,
    warehouse,
    workshopKanban,
    installation,
    syncedAt: new Date().toISOString(),
  };
}
