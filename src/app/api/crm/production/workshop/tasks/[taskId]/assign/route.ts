import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { settingsUsersListWhere } from "@/lib/authz/data-scope";
import { canManageProduction } from "@/features/production/server/permissions/production-permissions";
import { refreshFlowAiInsights } from "@/features/production/server/services/production-ai.service";

type Ctx = { params: Promise<{ taskId: string }> };

const bodySchema = z.object({
  assigneeUserId: z.string().min(1).nullable(),
});

export async function PATCH(request: Request, context: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  if (!canManageProduction(user)) {
    return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некоректні дані" }, { status: 400 });
  }

  const { taskId } = await context.params;
  const task = await prisma.productionTask.findUnique({
    where: { id: taskId },
    select: { id: true, flowId: true, type: true, title: true, metadataJson: true },
  });
  if (!task || task.type !== "WORKSHOP") {
    return NextResponse.json({ error: "Задачу цеху не знайдено" }, { status: 404 });
  }

  const meta = (task.metadataJson ?? {}) as { workshopStage?: string };
  const stage = meta.workshopStage ?? "CUTTING";
  if (stage !== "ASSEMBLY") {
    return NextResponse.json(
      {
        error: "Збірника призначає начальник цеху лише для задач на дільниці збірки",
      },
      { status: 400 },
    );
  }

  let assigneeUserId: string | null = parsed.data.assigneeUserId;
  if (assigneeUserId) {
    const listWhere = await settingsUsersListWhere(prisma, {
      id: user.id,
      role: user.dbRole,
    });
    const target = await prisma.user.findFirst({
      where: { id: assigneeUserId, ...(listWhere ?? {}) },
      select: { id: true, name: true, email: true },
    });
    if (!target) {
      return NextResponse.json({ error: "Користувача не знайдено або недоступний для призначення" }, { status: 400 });
    }
  } else {
    assigneeUserId = null;
  }

  await prisma.productionTask.update({
    where: { id: taskId },
    data: { assigneeUserId },
  });

  await prisma.productionEvent.create({
    data: {
      flowId: task.flowId,
      type: "WORKSHOP_ASSIGNEE_SET",
      title: assigneeUserId ? "Призначено збірника на задачу цеху" : "Знято збірника з задачі цеху",
      description: task.title,
      actorName: user.id,
    },
  });
  await refreshFlowAiInsights(task.flowId);
  return NextResponse.json({ ok: true });
}
