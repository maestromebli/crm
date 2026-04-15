import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canManageProduction } from "@/features/production/server/permissions/production-permissions";
import { assignConstructor } from "@/features/production/server/services/production-flow.service";
import { createConstructorTimelineEvent } from "@/features/constructor-hub/server/constructor-timeline.service";

type Ctx = { params: Promise<{ flowId: string }> };

const schema = z.object({
  constructorMode: z.enum(["INTERNAL", "OUTSOURCE"]),
  constructorName: z.string().min(2),
  constructorCompany: z.string().optional().nullable(),
  constructorWorkspaceUrl: z.string().url().optional().nullable(),
  dueDate: z.string().min(4),
});

export async function POST(request: Request, context: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  if (!canManageProduction(user)) {
    return NextResponse.json({ error: "Недостатньо прав для призначення конструктора" }, { status: 403 });
  }
  const { flowId } = await context.params;
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некоректні дані призначення конструктора" }, { status: 400 });
  }
  await assignConstructor(flowId, { ...parsed.data, actorName: user.id });
  const flowForWorkspace = await prisma.productionFlow.findUnique({
    where: { id: flowId },
    select: { id: true, dealId: true, dueDate: true, priority: true },
  });
  if (flowForWorkspace) {
    const matchedInternalUser =
      parsed.data.constructorMode === "INTERNAL"
        ? await prisma.user.findFirst({
            where: {
              OR: [{ name: parsed.data.constructorName }, { email: parsed.data.constructorName }],
            },
            select: { id: true },
          })
        : null;

    const workspace = await prisma.constructorWorkspace.upsert({
      where: { dealId: flowForWorkspace.dealId },
      update: {
        productionFlowId: flowForWorkspace.id,
        assignedByUserId: user.id,
        assignedConstructorUserId: matchedInternalUser?.id ?? null,
        status: "ASSIGNED",
        dueDate: flowForWorkspace.dueDate ?? new Date(parsed.data.dueDate),
        priority: flowForWorkspace.priority,
      },
      create: {
        dealId: flowForWorkspace.dealId,
        productionFlowId: flowForWorkspace.id,
        assignedByUserId: user.id,
        assignedConstructorUserId: matchedInternalUser?.id ?? null,
        status: "ASSIGNED",
        dueDate: flowForWorkspace.dueDate ?? new Date(parsed.data.dueDate),
        priority: flowForWorkspace.priority,
      },
    });

    await createConstructorTimelineEvent({
      workspaceId: workspace.id,
      dealId: workspace.dealId,
      productionFlowId: workspace.productionFlowId ?? null,
      actorUserId: user.id,
      eventType: "CONSTRUCTOR_ASSIGNED",
      title: "Конструктор назначен из production flow",
      description: parsed.data.constructorName,
      metadataJson: {
        constructorMode: parsed.data.constructorMode,
        constructorName: parsed.data.constructorName,
      },
    });
  }
  const flow = await prisma.productionFlow.findUnique({
    where: { id: flowId },
    select: { constructorWorkspaceUrl: true, telegramThreadUrl: true },
  });
  return NextResponse.json({
    ok: true,
    constructorWorkspaceUrl: flow?.constructorWorkspaceUrl ?? null,
    telegramThreadUrl: flow?.telegramThreadUrl ?? null,
  });
}
