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

  if (contract.status !== "PENDING_INTERNAL_APPROVAL") {
    return NextResponse.json({ error: "Контракт має бути у статусі UNDER_REVIEW" }, { status: 409 });
  }

  const updated = await prisma.dealContract.update({
    where: { id },
    data: { status: "APPROVED_INTERNAL" },
  });
  await prisma.activityLog.create({
    data: {
      entityType: "DEAL",
      entityId: contract.dealId,
      type: "CONTRACT_STATUS_CHANGED",
      actorUserId: user.id,
      source: "USER",
      data: { action: "approve", status: "APPROVED_INTERNAL" },
    },
  });
  return NextResponse.json({ ok: true, data: mapContractDetails(updated) });
}
