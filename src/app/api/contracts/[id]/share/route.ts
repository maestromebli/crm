import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser, forbidUnlessPermission } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { hashShareToken, newShareToken } from "@/lib/contracts/service";
import { shareContractSchema } from "@/lib/contracts/schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.CONTRACTS_UPDATE);
  if (denied) return denied;

  const { id } = await ctx.params;
  const contract = await prisma.dealContract.findUnique({ where: { id } });
  if (!contract) {
    return NextResponse.json({ error: "Контракт не знайдено" }, { status: 404 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = shareContractSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некоректні дані", details: parsed.error.flatten() }, { status: 400 });
  }
  if (contract.status !== "APPROVED_INTERNAL") {
    return NextResponse.json({ error: "Потрібен статус APPROVED" }, { status: 409 });
  }

  const expiresAt = new Date(Date.now() + parsed.data.expiresInHours * 60 * 60 * 1000);
  const token = newShareToken();
  const tokenHash = hashShareToken(token);

  await (prisma as any).contractShareLink.create({
    data: {
      contractId: id,
      tokenHash,
      expiresAt,
      maxViews: parsed.data.maxViews,
      createdById: user.id,
    },
  });

  await prisma.dealContract.update({
    where: { id },
    data: {
      status: "SENT_FOR_SIGNATURE",
    },
  });
  await prisma.activityLog.create({
    data: {
      entityType: "DEAL",
      entityId: contract.dealId,
      type: "CONTRACT_STATUS_CHANGED",
      actorUserId: user.id,
      source: "USER",
      data: {
        action: "share",
        expiresAt: expiresAt.toISOString(),
        maxViews: parsed.data.maxViews ?? null,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      token,
      expiresAt: expiresAt.toISOString(),
      portalUrl: `/portal/contracts/${token}`,
      apiPortalUrl: `/api/portal/contracts/${token}`,
    },
  });
}
