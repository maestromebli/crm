import { prisma } from "@/lib/prisma";
import { getGitLabRepositoryFileJson } from "@/lib/integrations/gitlab";
import { normalizeMiniHqTaskState } from "../../workshop-mini-hq";
import { saveWorkshopTaskMiniHq } from "./workshop-mini-hq.service";

type StageMetricJson = {
  cuttingMeters?: { actual?: number; plan?: number };
  edgingMeters?: { actual?: number; plan?: number };
  drillingUnits?: { actual?: number; plan?: number };
  assemblyUnits?: { actual?: number; plan?: number };
};

type MetricKey = "cuttingMeters" | "edgingMeters" | "drillingUnits" | "assemblyUnits";

function stageMetricKey(stageKey: string): MetricKey {
  switch (stageKey) {
    case "EDGING":
      return "edgingMeters";
    case "DRILLING":
      return "drillingUnits";
    case "ASSEMBLY":
      return "assemblyUnits";
    case "CUTTING":
    default:
      return "cuttingMeters";
  }
}

function parseNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function computePercent(actual: number | null, plan: number | null): number {
  if (!actual || !plan || plan <= 0) return 0;
  const raw = (actual / plan) * 100;
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  if (raw >= 100) return 100;
  return Math.round(raw);
}

export async function syncWorkshopTaskProgressFromGitLab(input: {
  taskId: string;
  actorName: string;
  gitlabProjectId: string;
  gitlabRef: string;
  gitlabPath: string;
}) {
  const task = await prisma.productionTask.findUnique({
    where: { id: input.taskId },
    select: {
      id: true,
      status: true,
      type: true,
      metadataJson: true,
    },
  });
  if (!task || task.type !== "WORKSHOP") {
    throw new Error("WORKSHOP_TASK_NOT_FOUND");
  }

  const taskMeta =
    task.metadataJson && typeof task.metadataJson === "object" && !Array.isArray(task.metadataJson)
      ? (task.metadataJson as Record<string, unknown>)
      : {};
  const workshopStage =
    typeof taskMeta.workshopStage === "string" && taskMeta.workshopStage.trim()
      ? taskMeta.workshopStage.trim()
      : "CUTTING";

  const metricKey = stageMetricKey(workshopStage);
  const syncedAt = new Date().toISOString();

  const file = await getGitLabRepositoryFileJson<StageMetricJson>({
    projectId: input.gitlabProjectId,
    filePath: input.gitlabPath,
    ref: input.gitlabRef,
  });
  if (file.ok === false) {
    const syncError = file.error;
    await saveWorkshopTaskMiniHq({
      taskId: task.id,
      actorName: input.actorName,
      patch: {
        gitlab: {
          projectId: input.gitlabProjectId,
          ref: input.gitlabRef,
          path: input.gitlabPath,
        },
        progress: {
          source: "manual",
          lastSyncedAt: syncedAt,
          lastError: syncError,
        },
      },
      eventType: "WORKSHOP_PROGRESS_SYNC_FAILED",
      eventTitle: "Синхронізація прогресу з GitLab не виконана",
      eventMeta: {
        taskId: task.id,
        error: syncError,
        gitlabProjectId: input.gitlabProjectId,
        gitlabRef: input.gitlabRef,
        gitlabPath: input.gitlabPath,
      },
    });
    return { ok: false as const, error: syncError };
  }

  const metric = file.data?.[metricKey] as { actual?: number; plan?: number } | undefined;
  const actual = parseNumeric(metric?.actual ?? null);
  const plan = parseNumeric(metric?.plan ?? null);
  const percent = computePercent(actual, plan);

  const current = normalizeMiniHqTaskState(taskMeta.miniHq, task.status);
  const keepDone100 = current.lifecycle.state === "DONE" ? 100 : percent;

  await saveWorkshopTaskMiniHq({
    taskId: task.id,
    actorName: input.actorName,
    patch: {
      gitlab: {
        projectId: input.gitlabProjectId,
        ref: input.gitlabRef,
        path: input.gitlabPath,
      },
      progress: {
        percent: keepDone100,
        source: "gitlab",
        stageMetricKey: metricKey,
        stageMetricActual: actual,
        stageMetricPlan: plan,
        lastSyncedAt: syncedAt,
        lastError: null,
      },
    },
    eventType: "WORKSHOP_PROGRESS_SYNCED",
    eventTitle: "Прогрес дільниці синхронізовано з GitLab",
    eventMeta: {
      taskId: task.id,
      metricKey,
      actual,
      plan,
      percent: keepDone100,
      gitlabProjectId: input.gitlabProjectId,
      gitlabRef: input.gitlabRef,
      gitlabPath: input.gitlabPath,
    },
  });
  return {
    ok: true as const,
    metricKey,
    percent: keepDone100,
    actual,
    plan,
    syncedAt,
  };
}

export async function setWorkshopTaskManualProgress(input: {
  taskId: string;
  actorName: string;
  percent: number;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(input.percent)));
  await saveWorkshopTaskMiniHq({
    taskId: input.taskId,
    actorName: input.actorName,
    patch: {
      progress: {
        percent: clamped,
        source: "manual",
        lastSyncedAt: new Date().toISOString(),
        lastError: null,
      },
    },
    eventType: "WORKSHOP_PROGRESS_MANUAL_SET",
    eventTitle: "Прогрес дільниці оновлено вручну",
    eventMeta: {
      taskId: input.taskId,
      percent: clamped,
    },
  });
}

