import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDealAccess } from "@/lib/deal-hub-api/access";

type Ctx = { params: Promise<{ dealId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { dealId } = await ctx.params;
  const access = await requireDealAccess(dealId);
  if ("error" in access) return access.error;

  const [room, workspace] = await Promise.all([
    prisma.dealConstructorRoom.findUnique({
      where: { dealId },
      select: {
        id: true,
        status: true,
        priority: true,
        dueAt: true,
        assignedUser: { select: { id: true, name: true, email: true } },
        updatedAt: true,
      },
    }),
    prisma.constructorWorkspace.findUnique({
      where: { dealId },
      select: {
        id: true,
        status: true,
        priority: true,
        dueDate: true,
        assignedConstructorUser: { select: { id: true, name: true, email: true } },
        snapshotOutdated: true,
        updatedAt: true,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, data: { room, workspace } });
}
