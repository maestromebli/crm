import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/authz/api-guard";
import {
  canManageProduction,
  canViewProduction,
} from "@/features/production/server/permissions/production-permissions";
import {
  completeWorkshopTask,
  getWorkshopTaskOrThrow,
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
      return NextResponse.json({ error: "Оператор може завершувати лише призначені задачі" }, { status: 403 });
    }
    await completeWorkshopTask({
      taskId,
      actorName: user.id,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSHOP_TASK_NOT_FOUND") {
      return NextResponse.json({ error: "Задачу цеху не знайдено" }, { status: 404 });
    }
    return NextResponse.json({ error: "Не вдалося завершити задачу" }, { status: 500 });
  }
}

