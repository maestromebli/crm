import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type {
  TaskEntityType,
  TaskPriority,
  TaskStatus,
  TaskType,
} from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../lib/authz/api-guard";
import { P } from "../../../lib/authz/permissions";
import { taskListWhereForUser } from "../../../lib/tasks/prisma-scope";
import { assertTaskEntityAccess } from "../../../lib/tasks/entity-access";
import { recordWorkflowEvent, WORKFLOW_EVENT_TYPES } from "@/features/event-system";

const TASK_TYPES: TaskType[] = [
  "CALLBACK",
  "SEND_QUOTE",
  "PREPARE_ESTIMATE",
  "SCHEDULE_MEETING",
  "VERIFY_PAYMENT",
  "FOLLOW_UP",
  "SEND_KP",
  "COLLECT_FILES",
  "CLARIFY_PROJECT",
  "APPROVAL_FOLLOW_UP",
  "OTHER",
];

const TASK_STATUSES: TaskStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
];

const TASK_PRIORITIES: TaskPriority[] = [
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
];

const ENTITY_TYPES: TaskEntityType[] = ["LEAD", "DEAL"];

function serializeTask(row: {
  id: string;
  title: string;
  description: string | null;
  entityType: TaskEntityType;
  entityId: string;
  taskType: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: Date | null;
  reminderAt: Date | null;
  assigneeId: string;
  createdById: string;
  completedAt: Date | null;
  resultComment: string | null;
  createdAt: Date;
  updatedAt: Date;
  assignee?: { name: string | null; email: string };
}) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    entityType: row.entityType,
    entityId: row.entityId,
    taskType: row.taskType,
    status: row.status,
    priority: row.priority,
    dueAt: row.dueAt?.toISOString() ?? null,
    reminderAt: row.reminderAt?.toISOString() ?? null,
    assigneeId: row.assigneeId,
    createdById: row.createdById,
    completedAt: row.completedAt?.toISOString() ?? null,
    resultComment: row.resultComment,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    assigneeName: row.assignee?.name ?? row.assignee?.email ?? null,
  };
}

export async function GET(req: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.TASKS_VIEW);
  if (denied) return denied;

  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType") as TaskEntityType | null;
  const entityId = url.searchParams.get("entityId");
  const status = url.searchParams.get("status") as TaskStatus | null;
  const overdue = url.searchParams.get("overdue") === "1";
  const dueOn = url.searchParams.get("dueOn");
  const assigneeId = url.searchParams.get("assigneeId");
  const mine = url.searchParams.get("mine") === "1";
  const titlePrefix = (url.searchParams.get("titlePrefix") ?? "").trim();

  let where = await taskListWhereForUser(prisma, user);

  if (entityType && entityId) {
    if (!ENTITY_TYPES.includes(entityType)) {
      return NextResponse.json(
        { error: "Некоректний entityType" },
        { status: 400 },
      );
    }
    const gate = await assertTaskEntityAccess(user, entityType, entityId);
    if (gate) return gate;
    where = {
      AND: [where, { entityType, entityId }],
    };
  }

  const filters: Record<string, unknown>[] = [];
  if (status && TASK_STATUSES.includes(status)) {
    filters.push({ status });
  }
  if (overdue) {
    filters.push({
      status: { not: "DONE" },
      dueAt: { lt: new Date() },
    });
  }
  if (dueOn && /^\d{4}-\d{2}-\d{2}$/.test(dueOn)) {
    const start = new Date(`${dueOn}T00:00:00`);
    const end = new Date(`${dueOn}T23:59:59.999`);
    filters.push({
      status: { notIn: ["DONE", "CANCELLED"] as TaskStatus[] },
      dueAt: { gte: start, lte: end },
    });
  }
  if (mine) {
    filters.push({ assigneeId: user.id });
  } else if (assigneeId) {
    filters.push({ assigneeId });
  }
  if (titlePrefix) {
    filters.push({ title: { startsWith: titlePrefix, mode: "insensitive" } });
  }

  if (filters.length > 0) {
    where = { AND: [where, ...filters] };
  }

  try {
    const rows = await prisma.task.findMany({
      where,
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 200,
      include: {
        assignee: { select: { name: true, email: true } },
      },
    });

    return NextResponse.json({
      items: rows.map((r) => serializeTask(r)),
    });
  } catch (e) {
     
    console.error("[GET /api/tasks]", e);
    return NextResponse.json(
      { error: "Помилка завантаження задач" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.TASKS_CREATE);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const title =
    typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Потрібен title" }, { status: 400 });
  }

  const entityType = body.entityType as TaskEntityType;
  const entityId =
    typeof body.entityId === "string" ? body.entityId.trim() : "";
  if (!ENTITY_TYPES.includes(entityType) || !entityId) {
    return NextResponse.json(
      { error: "Потрібні коректні entityType та entityId" },
      { status: 400 },
    );
  }

  const gate = await assertTaskEntityAccess(user, entityType, entityId);
  if (gate) return gate;

  const taskType = body.taskType as TaskType;
  if (!TASK_TYPES.includes(taskType)) {
    return NextResponse.json({ error: "Некоректний taskType" }, { status: 400 });
  }

  let assigneeId =
    typeof body.assigneeId === "string" && body.assigneeId.trim()
      ? body.assigneeId.trim()
      : user.id;

  if (assigneeId !== user.id) {
    const assignDenied = forbidUnlessPermission(user, P.TASKS_ASSIGN);
    if (assignDenied) return assignDenied;
  }

  const priority =
    typeof body.priority === "string" &&
    TASK_PRIORITIES.includes(body.priority as TaskPriority)
      ? (body.priority as TaskPriority)
      : "NORMAL";

  const description =
    body.description === null || typeof body.description === "string"
      ? body.description === null
        ? null
        : String(body.description)
      : null;

  let dueAt: Date | null = null;
  if (typeof body.dueAt === "string" && body.dueAt) {
    const d = new Date(body.dueAt);
    if (!Number.isNaN(d.getTime())) dueAt = d;
  }

  let reminderAt: Date | null = null;
  if (typeof body.reminderAt === "string" && body.reminderAt) {
    const d = new Date(body.reminderAt);
    if (!Number.isNaN(d.getTime())) reminderAt = d;
  }

  try {
    const row = await prisma.task.create({
      data: {
        title,
        description,
        entityType,
        entityId,
        taskType,
        status: "OPEN",
        priority,
        dueAt,
        reminderAt,
        assigneeId,
        createdById: user.id,
      },
      include: {
        assignee: { select: { name: true, email: true } },
      },
    });

    if (entityType === "LEAD") {
      await prisma.lead.update({
        where: { id: entityId },
        data: { lastActivityAt: new Date() },
      });
    }
    await recordWorkflowEvent(
      WORKFLOW_EVENT_TYPES.TASK_CREATED,
      entityType === "LEAD"
        ? { leadId: entityId, taskId: row.id }
        : { dealId: entityId, taskId: row.id },
      {
        entityType,
        entityId,
        dealId: entityType === "DEAL" ? entityId : null,
        userId: user.id,
        dedupeKey: `task-created:${row.id}`,
      },
    );
    if (
      row.dueAt &&
      row.status !== "DONE" &&
      row.status !== "CANCELLED" &&
      row.dueAt.getTime() < Date.now()
    ) {
      await recordWorkflowEvent(
        WORKFLOW_EVENT_TYPES.TASK_OVERDUE,
        entityType === "LEAD"
          ? { leadId: entityId, taskId: row.id }
          : { dealId: entityId, taskId: row.id },
        {
          entityType,
          entityId,
          dealId: entityType === "DEAL" ? entityId : null,
          userId: user.id,
          dedupeKey: `task-overdue:${row.id}:${new Date().toISOString().slice(0, 10)}`,
        },
      );
    }

    revalidatePath("/tasks");
    if (entityType === "DEAL") {
      revalidatePath(`/deals/${entityId}/workspace`);
    }
    if (entityType === "LEAD") {
      revalidatePath("/leads");
      revalidatePath(`/leads/${entityId}`);
      revalidatePath(`/leads/${entityId}/tasks`);
    }

    return NextResponse.json({ ok: true, task: serializeTask(row) });
  } catch (e) {
     
    console.error("[POST /api/tasks]", e);
    return NextResponse.json(
      { error: "Помилка створення задачі" },
      { status: 500 },
    );
  }
}
