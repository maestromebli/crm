import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { refreshFlowAiInsights } from "@/features/production/server/services/production-ai.service";

type Ctx = { params: Promise<{ token: string }> };

const schema = z.object({
  status: z.enum(["IN_PROGRESS", "READY_FOR_REVIEW"]),
});

export async function POST(request: Request, context: Ctx) {
  const { token } = await context.params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Некоректний статус" }, { status: 400 });

  const tokenPath = `/constructor/${token}`;
  const flow = await prisma.productionFlow.findFirst({
    where: { constructorWorkspaceUrl: { contains: tokenPath } },
    select: { id: true },
  });
  if (!flow) return NextResponse.json({ error: "Робоче місце не знайдено" }, { status: 404 });

  if (parsed.data.status === "IN_PROGRESS") {
    await prisma.productionFlow.update({
      where: { id: flow.id },
      data: { currentStepKey: "CONSTRUCTOR_IN_PROGRESS", status: "ACTIVE" },
    });
  } else {
    await prisma.productionFlow.update({
      where: { id: flow.id },
      data: { currentStepKey: "FILES_PACKAGE_UPLOADED", status: "ACTIVE" },
    });
  }

  await prisma.productionEvent.create({
    data: {
      flowId: flow.id,
      type: "CONSTRUCTOR_STATUS_CHANGED",
      title: parsed.data.status === "IN_PROGRESS" ? "Конструктор: В роботі" : "Конструктор: Готово до перевірки",
      actorName: "Constructor",
    },
  });
  await refreshFlowAiInsights(flow.id);
  return NextResponse.json({ ok: true });
}
