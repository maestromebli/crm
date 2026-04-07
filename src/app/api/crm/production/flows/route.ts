import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canViewProduction } from "@/features/production/server/permissions/production-permissions";

export async function GET(request: Request) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  if (!canViewProduction(user)) {
    return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const currentStepKey = searchParams.get("currentStepKey");
  const priority = searchParams.get("priority");
  const search = searchParams.get("search");

  const flows = await prisma.productionFlow.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(currentStepKey ? { currentStepKey: currentStepKey as never } : {}),
      ...(priority ? { priority: priority as never } : {}),
      ...(search
        ? {
            OR: [
              { number: { contains: search, mode: "insensitive" } },
              { title: { contains: search, mode: "insensitive" } },
              { clientName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ riskScore: "desc" }, { updatedAt: "desc" }],
    take: 200,
  });

  return NextResponse.json({
    flows: flows.map((flow) => ({
      id: flow.id,
      number: flow.number,
      title: flow.title,
      clientName: flow.clientName,
      status: flow.status,
      currentStepKey: flow.currentStepKey,
      priority: flow.priority,
      readinessPercent: flow.readinessPercent,
      riskScore: flow.riskScore,
      dueDate: flow.dueDate?.toISOString() ?? null,
      blockersCount: flow.blockersCount,
      openQuestionsCount: flow.openQuestionsCount,
      updatedAt: flow.updatedAt.toISOString(),
    })),
  });
}
