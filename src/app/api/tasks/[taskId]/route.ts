import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import { prisma } from "../../../../lib/prisma";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../lib/authz/api-guard";
import { P } from "../../../../lib/authz/permissions";
import { hasTaskAssignScope } from "../../../../lib/authz/roles";
import { taskListWhereForUser } from "../../../../lib/tasks/prisma-scope";

const STATUSES: TaskStatus[] = ["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"];

const PRIORITIES: TaskPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

type Ctx = { params: Promise<{ taskId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.TASKS_UPDATE);
  if (denied) return denied;

  const { taskId } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const scopeWhere = await taskListWhereForUser(prisma, user);

  try {
    const existing = await prisma.task.findFirst({
      where: { AND: [scopeWhere, { id: taskId }] },
    });
    if (!existing) {
      return NextResponse.json({ error: "Задачу не знайдено" }, { status: 404 });
    }

    const data: Prisma.TaskUncheckedUpdateInput = {};

    if (typeof body.title === "string" && body.title.trim()) {
      data.title = body.title.trim();
    }
    if (body.description === null || typeof body.description === "string") {
      data.description =
        body.description === null ? null : String(body.description);
    }
    if (typeof body.status === "string" && STATUSES.includes(body.status as TaskStatus)) {
      data.status = body.status as TaskStatus;
      if (data.status === "DONE") {
        data.completedAt = new Date();
      } else {
        data.completedAt = null;
      }
    }
    if (typeof body.resultComment === "string") {
      data.resultComment = body.resultComment.trim() || null;
    }
    if (typeof body.dueAt === "string") {
      if (body.dueAt === "") data.dueAt = null;
      else {
        const d = new Date(body.dueAt);
        if (!Number.isNaN(d.getTime())) data.dueAt = d;
      }
    }
    if (typeof body.reminderAt === "string") {
      if (body.reminderAt === "") data.reminderAt = null;
      else {
        const d = new Date(body.reminderAt);
        if (!Number.isNaN(d.getTime())) data.reminderAt = d;
      }
    }
    if (
      typeof body.priority === "string" &&
      PRIORITIES.includes(body.priority as TaskPriority)
    ) {
      data.priority = body.priority as TaskPriority;
    }
    if (typeof body.assigneeId === "string" && body.assigneeId.trim()) {
      const nextAssignee = body.assigneeId.trim();
      if (nextAssignee !== existing.assigneeId) {
        const ad = forbidUnlessPermission(user, P.TASKS_ASSIGN);
        if (ad) return ad;
      }
      if (
        !hasTaskAssignScope(user.role) &&
        nextAssignee !== user.id &&
        nextAssignee !== existing.assigneeId
      ) {
        return NextResponse.json(
          { error: "Можна призначати лише себе або залишити поточного виконавця" },
          { status: 403 },
        );
      }
      data.assigneeId = nextAssignee;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Немає полів для оновлення" },
        { status: 400 },
      );
    }

    const row = await prisma.task.update({
      where: { id: taskId },
      data,
      include: {
        assignee: { select: { name: true, email: true } },
      },
    });

    revalidatePath("/tasks");
    if (row.entityType === "DEAL") {
      revalidatePath(`/deals/${row.entityId}/workspace`);
    }
    revalidatePath("/leads");
    if (row.entityType === "LEAD") {
      revalidatePath(`/leads/${row.entityId}`);
      revalidatePath(`/leads/${row.entityId}/tasks`);
    }

    return NextResponse.json({ ok: true, id: row.id, status: row.status });
  } catch (e) {
     
    console.error("[PATCH /api/tasks/[taskId]]", e);
    return NextResponse.json(
      { error: "Помилка оновлення" },
      { status: 500 },
    );
  }
}
