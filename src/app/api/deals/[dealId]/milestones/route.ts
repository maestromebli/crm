import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDealAccess } from "@/lib/deal-hub-api/access";

type Ctx = { params: Promise<{ dealId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { dealId } = await ctx.params;
  const access = await requireDealAccess(dealId);
  if ("error" in access) return access.error;

  const [paymentMilestones, openTasks] = await Promise.all([
    prisma.dealPaymentMilestone.findMany({
      where: { dealId },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        label: true,
        amount: true,
        dueAt: true,
        confirmedAt: true,
        sortOrder: true,
      },
    }),
    prisma.task.findMany({
      where: {
        entityType: "DEAL",
        entityId: dealId,
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 40,
      select: {
        id: true,
        title: true,
        dueAt: true,
        status: true,
        priority: true,
      },
    }),
  ]);

  const data = {
    payments: paymentMilestones,
    tasks: openTasks,
  };
  return NextResponse.json({ ok: true, data });
}
