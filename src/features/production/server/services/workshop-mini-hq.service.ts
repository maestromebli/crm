import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  computeActiveSecondsWithNow,
  normalizeMiniHqTaskState,
  normalizeMiniHqTree,
  type MiniHqPauseReasonCode,
  type MiniHqTaskState,
  type MiniHqTreeNode,
} from "../../workshop-mini-hq";

type MiniHqTaskPatch = {
  lifecycle?: Partial<MiniHqTaskState["lifecycle"]>;
  progress?: Partial<MiniHqTaskState["progress"]>;
  gitlab?: Partial<MiniHqTaskState["gitlab"]>;
};

type WorkshopTaskLite = {
  id: string;
  flowId: string;
  title: string;
  type: string;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED" | "CANCELLED";
  assigneeUserId: string | null;
  metadataJson: Prisma.JsonValue | null;
};

function readTaskMeta(task: WorkshopTaskLite): Record<string, unknown> {
  const m = task.metadataJson;
  if (m && typeof m === "object" && !Array.isArray(m)) return m as Record<string, unknown>;
  return {};
}

function patchTaskMiniHq(task: WorkshopTaskLite, state: MiniHqTaskState): Prisma.InputJsonValue {
  const prev = readTaskMeta(task);
  return {
    ...prev,
    miniHq: state,
  } as Prisma.InputJsonValue;
}

async function appendEvent(input: {
  flowId: string;
  actorName: string;
  type: string;
  title: string;
  description?: string | null;
  metadataJson?: Record<string, unknown>;
}) {
  await prisma.productionEvent.create({
    data: {
      flowId: input.flowId,
      actorName: input.actorName,
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      metadataJson: (input.metadataJson ?? null) as Prisma.InputJsonValue,
    },
  });
}

export async function getWorkshopTaskOrThrow(taskId: string): Promise<WorkshopTaskLite> {
  const task = await prisma.productionTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      flowId: true,
      title: true,
      type: true,
      status: true,
      assigneeUserId: true,
      metadataJson: true,
    },
  });
  if (!task || task.type !== "WORKSHOP") {
    throw new Error("WORKSHOP_TASK_NOT_FOUND");
  }
  return task;
}

export async function startWorkshopTask(input: { taskId: string; actorName: string }) {
  const task = await getWorkshopTaskOrThrow(input.taskId);
  const now = new Date().toISOString();
  const miniHq = normalizeMiniHqTaskState(readTaskMeta(task).miniHq, task.status);
  if (miniHq.lifecycle.state === "DONE") {
    throw new Error("TASK_ALREADY_DONE");
  }
  if (!miniHq.lifecycle.startedAt) {
    miniHq.lifecycle.startedAt = now;
  }
  miniHq.lifecycle.state = "RUNNING";
  miniHq.lifecycle.lastResumedAt = now;
  miniHq.lifecycle.lastPausedAt = null;
  miniHq.lifecycle.pauseReasonCode = null;
  miniHq.lifecycle.pauseComment = null;

  await prisma.productionTask.update({
    where: { id: task.id },
    data: {
      status: "IN_PROGRESS",
      metadataJson: patchTaskMiniHq(task, miniHq),
    },
  });
  await appendEvent({
    flowId: task.flowId,
    actorName: input.actorName,
    type: "WORKSHOP_TASK_STARTED",
    title: "Задачу дільниці запущено",
    description: task.title,
    metadataJson: { taskId: task.id },
  });
}

export async function pauseWorkshopTask(input: {
  taskId: string;
  actorName: string;
  reasonCode: MiniHqPauseReasonCode;
  comment?: string | null;
}) {
  const task = await getWorkshopTaskOrThrow(input.taskId);
  const now = new Date().toISOString();
  const miniHq = normalizeMiniHqTaskState(readTaskMeta(task).miniHq, task.status);
  if (miniHq.lifecycle.state === "DONE") {
    throw new Error("TASK_ALREADY_DONE");
  }
  miniHq.lifecycle.activeSeconds = computeActiveSecondsWithNow(miniHq.lifecycle, now);
  miniHq.lifecycle.state = "PAUSED";
  miniHq.lifecycle.lastPausedAt = now;
  miniHq.lifecycle.lastResumedAt = null;
  miniHq.lifecycle.pauseReasonCode = input.reasonCode;
  miniHq.lifecycle.pauseComment = input.comment?.trim() ? input.comment.trim() : null;
  if (!miniHq.lifecycle.startedAt) miniHq.lifecycle.startedAt = now;

  await prisma.productionTask.update({
    where: { id: task.id },
    data: {
      status: "BLOCKED",
      metadataJson: patchTaskMiniHq(task, miniHq),
    },
  });
  await appendEvent({
    flowId: task.flowId,
    actorName: input.actorName,
    type: "WORKSHOP_TASK_PAUSED",
    title: "Задачу дільниці поставлено на паузу",
    description: task.title,
    metadataJson: { taskId: task.id, reasonCode: input.reasonCode, comment: miniHq.lifecycle.pauseComment },
  });
}

export async function resumeWorkshopTask(input: { taskId: string; actorName: string }) {
  const task = await getWorkshopTaskOrThrow(input.taskId);
  const now = new Date().toISOString();
  const miniHq = normalizeMiniHqTaskState(readTaskMeta(task).miniHq, task.status);
  if (miniHq.lifecycle.state === "DONE") {
    throw new Error("TASK_ALREADY_DONE");
  }
  if (!miniHq.lifecycle.startedAt) miniHq.lifecycle.startedAt = now;
  miniHq.lifecycle.state = "RUNNING";
  miniHq.lifecycle.lastResumedAt = now;
  miniHq.lifecycle.lastPausedAt = null;
  miniHq.lifecycle.pauseReasonCode = null;
  miniHq.lifecycle.pauseComment = null;

  await prisma.productionTask.update({
    where: { id: task.id },
    data: {
      status: "IN_PROGRESS",
      metadataJson: patchTaskMiniHq(task, miniHq),
    },
  });
  await appendEvent({
    flowId: task.flowId,
    actorName: input.actorName,
    type: "WORKSHOP_TASK_RESUMED",
    title: "Задачу дільниці відновлено",
    description: task.title,
    metadataJson: { taskId: task.id },
  });
}

export async function completeWorkshopTask(input: { taskId: string; actorName: string }) {
  const task = await getWorkshopTaskOrThrow(input.taskId);
  const now = new Date().toISOString();
  const miniHq = normalizeMiniHqTaskState(readTaskMeta(task).miniHq, task.status);
  miniHq.lifecycle.activeSeconds = computeActiveSecondsWithNow(miniHq.lifecycle, now);
  miniHq.lifecycle.state = "DONE";
  miniHq.lifecycle.completedAt = now;
  miniHq.lifecycle.lastResumedAt = null;
  miniHq.lifecycle.lastPausedAt = null;
  miniHq.lifecycle.pauseReasonCode = null;
  miniHq.lifecycle.pauseComment = null;
  if (!miniHq.lifecycle.startedAt) miniHq.lifecycle.startedAt = now;

  if (miniHq.progress.percent < 100) {
    miniHq.progress.percent = 100;
    miniHq.progress.source = miniHq.progress.source === "gitlab" ? "gitlab" : "manual";
    miniHq.progress.lastSyncedAt = now;
    miniHq.progress.lastError = null;
  }

  await prisma.productionTask.update({
    where: { id: task.id },
    data: {
      status: "DONE",
      metadataJson: patchTaskMiniHq(task, miniHq),
    },
  });
  await appendEvent({
    flowId: task.flowId,
    actorName: input.actorName,
    type: "WORKSHOP_TASK_COMPLETED",
    title: "Задачу дільниці завершено",
    description: task.title,
    metadataJson: { taskId: task.id, activeSeconds: miniHq.lifecycle.activeSeconds },
  });
}

export async function saveWorkshopTaskMiniHq(input: {
  taskId: string;
  actorName: string;
  patch: MiniHqTaskPatch;
  eventType: string;
  eventTitle: string;
  eventMeta?: Record<string, unknown>;
}) {
  const task = await getWorkshopTaskOrThrow(input.taskId);
  const miniHq = normalizeMiniHqTaskState(readTaskMeta(task).miniHq, task.status);
  const merged: MiniHqTaskState = {
    lifecycle: { ...miniHq.lifecycle, ...(input.patch.lifecycle ?? {}) },
    progress: { ...miniHq.progress, ...(input.patch.progress ?? {}) },
    gitlab: { ...miniHq.gitlab, ...(input.patch.gitlab ?? {}) },
  };
  await prisma.productionTask.update({
    where: { id: task.id },
    data: {
      metadataJson: patchTaskMiniHq(task, merged),
    },
  });
  await appendEvent({
    flowId: task.flowId,
    actorName: input.actorName,
    type: input.eventType,
    title: input.eventTitle,
    description: task.title,
    metadataJson: input.eventMeta,
  });
}

function readFlowMeta(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

export async function getProjectTree(projectId: string): Promise<MiniHqTreeNode[]> {
  const flow = await prisma.productionFlow.findUnique({
    where: { id: projectId },
    select: { dealId: true },
  });
  if (!flow) throw new Error("PROJECT_NOT_FOUND");
  const deal = await prisma.deal.findUnique({
    where: { id: flow.dealId },
    select: { workspaceMeta: true },
  });
  const meta = readFlowMeta(deal?.workspaceMeta);
  return normalizeMiniHqTree(meta.miniHqTree);
}

export async function setProjectTree(input: { projectId: string; nodes: MiniHqTreeNode[] }) {
  const flow = await prisma.productionFlow.findUnique({
    where: { id: input.projectId },
    select: { id: true, dealId: true },
  });
  if (!flow) throw new Error("PROJECT_NOT_FOUND");
  const deal = await prisma.deal.findUnique({
    where: { id: flow.dealId },
    select: { workspaceMeta: true },
  });
  const prev = readFlowMeta(deal?.workspaceMeta);
  await prisma.deal.update({
    where: { id: flow.dealId },
    data: {
      workspaceMeta: {
        ...prev,
        miniHqTree: input.nodes,
      } as Prisma.InputJsonValue,
    },
  });
}

