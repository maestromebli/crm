import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDealAccess } from "@/lib/deal-hub-api/access";

type Ctx = { params: Promise<{ dealId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { dealId } = await ctx.params;
  const access = await requireDealAccess(dealId);
  if ("error" in access) return access.error;

  const [flow, handoff] = await Promise.all([
    prisma.productionFlow.findUnique({
      where: { dealId },
      select: {
        id: true,
        number: true,
        status: true,
        currentStepKey: true,
        readinessPercent: true,
        riskScore: true,
        blockersCount: true,
        dueDate: true,
        acceptedAt: true,
        updatedAt: true,
      },
    }),
    prisma.dealHandoff.findUnique({
      where: { dealId },
      select: {
        id: true,
        status: true,
        submittedAt: true,
        acceptedAt: true,
        rejectedAt: true,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, data: { flow, handoff } });
}
