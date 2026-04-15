import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashShareToken } from "@/lib/contracts/service";

type Ctx = { params: Promise<{ token: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const tokenHash = hashShareToken(token);
  const share = await (prisma as any).contractShareLink.findUnique({
    where: { tokenHash },
    include: { contract: true },
  });
  if (!share) return NextResponse.json({ error: "Посилання не знайдено" }, { status: 404 });
  if (share.status !== "ACTIVE") return NextResponse.json({ error: "Посилання неактивне" }, { status: 410 });

  await prisma.$transaction([
    (prisma as any).contractShareLink.update({
      where: { id: share.id },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: new Date(),
      },
    }),
    prisma.dealContract.update({
      where: { id: share.contractId },
      data: {
        status: "VIEWED_BY_CLIENT",
      },
    }),
    prisma.activityLog.create({
      data: {
        entityType: "DEAL",
        entityId: share.contract.dealId,
        type: "CONTRACT_STATUS_CHANGED",
        actorUserId: null,
        source: "INTEGRATION",
        data: {
          action: "portal_viewed",
          status: "VIEWED_BY_CLIENT",
        },
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
