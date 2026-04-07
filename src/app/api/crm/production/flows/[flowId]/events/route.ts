import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canViewProduction } from "@/features/production/server/permissions/production-permissions";

type Ctx = { params: Promise<{ flowId: string }> };

export async function GET(_request: Request, context: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  if (!canViewProduction(user)) {
    return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
  }
  const { flowId } = await context.params;
  const events = await prisma.productionEvent.findMany({
    where: { flowId },
    orderBy: { createdAt: "desc" },
    take: 150,
  });
  return NextResponse.json({
    events: events.map((event) => ({
      id: event.id,
      type: event.type,
      actorName: event.actorName,
      title: event.title,
      description: event.description,
      createdAt: event.createdAt.toISOString(),
    })),
  });
}
