import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser, forbidUnlessPermission } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { mapContractDetails } from "@/lib/contracts/service";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.CONTRACTS_UPDATE);
  if (denied) return denied;

  const { id } = await ctx.params;
  const contract = await prisma.dealContract.findUnique({ where: { id } });
  if (!contract) {
    return NextResponse.json({ error: "Контракт не знайдено" }, { status: 404 });
  }

  const updated = await prisma.dealContract.update({
    where: { id },
    data: { status: "PENDING_INTERNAL_APPROVAL" },
  });
  await prisma.activityLog.create({
    data: {
      entityType: "DEAL",
      entityId: contract.dealId,
      type: "CONTRACT_STATUS_CHANGED",
      actorUserId: user.id,
      source: "USER",
      data: { action: "send_for_review", status: "PENDING_INTERNAL_APPROVAL" },
    },
  });
  return NextResponse.json({ ok: true, data: mapContractDetails(updated) });
}
