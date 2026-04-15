import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionUser } from "@/lib/authz/api-guard";
import {
  canManageProduction,
  canViewProduction,
} from "@/features/production/server/permissions/production-permissions";
import { MINI_HQ_PAUSE_REASONS } from "@/features/production/workshop-mini-hq";
import type { MiniHqPauseReasonCode } from "@/features/production/workshop-mini-hq";
import {
  getWorkshopTaskOrThrow,
  pauseWorkshopTask,
} from "@/features/production/server/services/workshop-mini-hq.service";

type Ctx = { params: Promise<{ taskId: string }> };

const schema = z.object({
  reasonCode: z.enum(MINI_HQ_PAUSE_REASONS.map((x) => x.code) as [string, ...string[]]),
  comment: z.string().max(400).optional().nullable(),
});

export async function POST(request: Request, context: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  if (!canViewProduction(user)) {
    return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Некоректна причина паузи" }, { status: 400 });
  }
  const { taskId } = await context.params;
  try {
    const task = await getWorkshopTaskOrThrow(taskId);
    const canManage = canManageProduction(user);
    if (!canManage && task.assigneeUserId !== user.id) {
      return NextResponse.json({ error: "Оператор може ставити на паузу лише призначені задачі" }, { status: 403 });
    }
    await pauseWorkshopTask({
      taskId,
      actorName: user.id,
      reasonCode: parsed.data.reasonCode as MiniHqPauseReasonCode,
      comment: parsed.data.comment ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSHOP_TASK_NOT_FOUND") {
      return NextResponse.json({ error: "Задачу цеху не знайдено" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "TASK_ALREADY_DONE") {
      return NextResponse.json({ error: "Задача вже завершена" }, { status: 409 });
    }
    return NextResponse.json({ error: "Не вдалося поставити задачу на паузу" }, { status: 500 });
  }
}

