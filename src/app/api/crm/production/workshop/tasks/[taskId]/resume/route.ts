import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/authz/api-guard";
import {
  canManageProduction,
  canViewProduction,
} from "@/features/production/server/permissions/production-permissions";
import {
  getWorkshopTaskOrThrow,
  resumeWorkshopTask,
} from "@/features/production/server/services/workshop-mini-hq.service";

type Ctx = { params: Promise<{ taskId: string }> };

export async function POST(_request: Request, context: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  if (!canViewProduction(user)) {
    return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
  }
  const { taskId } = await context.params;
  try {
    const task = await getWorkshopTaskOrThrow(taskId);
    const canManage = canManageProduction(user);
    if (!canManage && task.assigneeUserId !== user.id) {
      return NextResponse.json({ error: "Оператор може відновлювати лише призначені задачі" }, { status: 403 });
    }
    await resumeWorkshopTask({
      taskId,
      actorName: user.id,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSHOP_TASK_NOT_FOUND") {
      return NextResponse.json({ error: "Задачу цеху не знайдено" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "TASK_ALREADY_DONE") {
      return NextResponse.json({ error: "Задача вже завершена" }, { status: 409 });
    }
    return NextResponse.json({ error: "Не вдалося відновити задачу" }, { status: 500 });
  }
}

