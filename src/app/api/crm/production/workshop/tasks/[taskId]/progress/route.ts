import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionUser } from "@/lib/authz/api-guard";
import {
  canManageProduction,
  canViewProduction,
} from "@/features/production/server/permissions/production-permissions";
import { getWorkshopTaskOrThrow } from "@/features/production/server/services/workshop-mini-hq.service";
import {
  setWorkshopTaskManualProgress,
  syncWorkshopTaskProgressFromGitLab,
} from "@/features/production/server/services/workshop-mini-hq-progress.service";

type Ctx = { params: Promise<{ taskId: string }> };

const syncSchema = z.object({
  gitlabProjectId: z.string().min(1).max(120),
  gitlabRef: z.string().min(1).max(120).default("main"),
  gitlabPath: z.string().min(1).max(400),
});

const manualSchema = z.object({
  percent: z.number().min(0).max(100),
});

async function ensureAccess(taskId: string, user: Awaited<ReturnType<typeof requireSessionUser>>) {
  if (user instanceof NextResponse) return user;
  if (!canViewProduction(user)) {
    return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
  }
  const task = await getWorkshopTaskOrThrow(taskId);
  const canManage = canManageProduction(user);
  if (!canManage && task.assigneeUserId !== user.id) {
    return NextResponse.json({ error: "Оператор може змінювати лише призначені задачі" }, { status: 403 });
  }
  return null;
}

export async function POST(request: Request, context: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const { taskId } = await context.params;
  try {
    const denied = await ensureAccess(taskId, user);
    if (denied) return denied;
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSHOP_TASK_NOT_FOUND") {
      return NextResponse.json({ error: "Задачу цеху не знайдено" }, { status: 404 });
    }
    return NextResponse.json({ error: "Не вдалося перевірити доступ" }, { status: 500 });
  }

  const parsed = syncSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Некоректні параметри синхронізації GitLab" }, { status: 400 });
  }

  try {
    const result = await syncWorkshopTaskProgressFromGitLab({
      taskId,
      actorName: user.id,
      gitlabProjectId: parsed.data.gitlabProjectId,
      gitlabRef: parsed.data.gitlabRef,
      gitlabPath: parsed.data.gitlabPath,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSHOP_TASK_NOT_FOUND") {
      return NextResponse.json({ error: "Задачу цеху не знайдено" }, { status: 404 });
    }
    return NextResponse.json({ error: "Не вдалося синхронізувати прогрес" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const { taskId } = await context.params;
  try {
    const denied = await ensureAccess(taskId, user);
    if (denied) return denied;
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSHOP_TASK_NOT_FOUND") {
      return NextResponse.json({ error: "Задачу цеху не знайдено" }, { status: 404 });
    }
    return NextResponse.json({ error: "Не вдалося перевірити доступ" }, { status: 500 });
  }
  const parsed = manualSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Некоректний відсоток готовності" }, { status: 400 });
  }
  try {
    await setWorkshopTaskManualProgress({
      taskId,
      actorName: user.id,
      percent: parsed.data.percent,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSHOP_TASK_NOT_FOUND") {
      return NextResponse.json({ error: "Задачу цеху не знайдено" }, { status: 404 });
    }
    return NextResponse.json({ error: "Не вдалося оновити прогрес вручну" }, { status: 500 });
  }
}

