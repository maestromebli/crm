import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canManageProduction } from "@/features/production/server/permissions/production-permissions";
import { assignConstructor } from "@/features/production/server/services/production-flow.service";

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
