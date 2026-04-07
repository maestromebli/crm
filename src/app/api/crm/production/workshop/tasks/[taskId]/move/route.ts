import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canManageProduction } from "@/features/production/server/permissions/production-permissions";
import { refreshFlowAiInsights } from "@/features/production/server/services/production-ai.service";

type Ctx = { params: Promise<{ taskId: string }> };

const schema = z.object({
  stageKey: z.enum(["CUTTING", "EDGING", "DRILLING", "ASSEMBLY", "PAINTING", "PACKAGING"]),
});

export async function POST(request: Request, context: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  if (!canManageProduction(user)) {
    return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некоректна колонка канбану" }, { status: 400 });
  }

  const { taskId } = await context.params;
  const task = await prisma.productionTask.findUnique({
    where: { id: taskId },
    select: { id: true, flowId: true, type: true, metadataJson: true },
  });
  if (!task || task.type !== "WORKSHOP") {
    return NextResponse.json({ error: "Задачу цеху не знайдено" }, { status: 404 });
  }

  const metadata = (task.metadataJson ?? {}) as Record<string, unknown>;
  await prisma.productionTask.update({
    where: { id: taskId },
    data: {
      metadataJson: {
        ...metadata,
        workshopStage: parsed.data.stageKey,
      },
      status: "IN_PROGRESS",
    },
  });
  await prisma.productionEvent.create({
    data: {
      flowId: task.flowId,
      type: "WORKSHOP_TASK_MOVED",
      title: `Задачу цеху переміщено в ${parsed.data.stageKey}`,
      actorName: user.id,
    },
  });
  await refreshFlowAiInsights(task.flowId);
  return NextResponse.json({ ok: true });
}
