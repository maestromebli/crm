import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authz/api-guard";
import {
  canManageProduction,
  canViewProduction,
} from "@/features/production/server/permissions/production-permissions";
import {
  isMaterialsChecklistProgressOnly,
  normalizeMaterialsChecklist,
  type WorkshopMaterialCheckItem,
} from "@/features/production/workshop-materials";

type Ctx = { params: Promise<{ taskId: string }> };

const bodySchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1).max(500),
      done: z.boolean(),
      scope: z
        .enum(["plate", "parts_edge", "drill_prep", "assembly", "paint", "pack", "general"])
        .optional(),
    }),
  ),
});

export async function PATCH(request: Request, context: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const canManage = canManageProduction(user);
  const canView = canViewProduction(user);
  if (!canManage && !canView) {
    return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некоректний чекліст" }, { status: 400 });
  }

  const { taskId } = await context.params;
  const task = await prisma.productionTask.findUnique({
    where: { id: taskId },
    select: { id: true, flowId: true, type: true, metadataJson: true, title: true },
  });
  if (!task || task.type !== "WORKSHOP") {
    return NextResponse.json({ error: "Задачу цеху не знайдено" }, { status: 404 });
  }

  const metadata = (task.metadataJson ?? {}) as Record<string, unknown>;
  const existing = normalizeMaterialsChecklist(metadata.materialsChecklist);
  const incomingRaw = parsed.data.items.slice(0, 80) as WorkshopMaterialCheckItem[];

  if (!canManage) {
    if (!isMaterialsChecklistProgressOnly(existing, incomingRaw)) {
      return NextResponse.json(
        { error: "Змінювати склад чекліста може лише начальник цеху / керування виробництвом" },
        { status: 403 },
      );
    }
  }

  const items = incomingRaw;

  await prisma.productionTask.update({
    where: { id: taskId },
    data: {
      metadataJson: {
        ...metadata,
        materialsChecklist: items,
      },
      status: "IN_PROGRESS",
    },
  });

  await prisma.productionEvent.create({
    data: {
      flowId: task.flowId,
      type: "WORKSHOP_MATERIALS_CHECKLIST_UPDATED",
      title: canManage
        ? "Оновлено чекліст матеріалів цеху"
        : "Оновлено прогрес чеклісту матеріалів (оператор)",
      description: task.title,
      actorName: user.id,
    },
  });

  return NextResponse.json({ ok: true });
}
