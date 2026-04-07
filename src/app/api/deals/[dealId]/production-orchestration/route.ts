import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "@/lib/authz/api-guard";
import { P, hasEffectivePermission } from "@/lib/authz/permissions";

type Ctx = { params: Promise<{ dealId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { dealId } = await ctx.params;

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, ownerId: true },
  });
  if (!deal) {
    return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
  }

  const denied = await forbidUnlessDealAccess(user, P.DEALS_VIEW, deal);
  if (denied) return denied;

  if (
    !hasEffectivePermission(user.permissionKeys, P.PRODUCTION_ORCHESTRATION_VIEW, {
      realRole: user.realRole,
      impersonatorId: user.impersonatorId,
    })
  ) {
    return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
  }

  const orch = await prisma.productionOrchestration.findUnique({
    where: { dealId },
    include: {
      acceptedBy: { select: { id: true, name: true, email: true } },
      constructorUser: { select: { id: true, name: true, email: true } },
    },
  });

  const clarifications = await prisma.productionHandoffClarification.findMany({
    where: { dealId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      status: true,
      issuesJson: true,
      messageToManager: true,
      createdAt: true,
      resolvedAt: true,
    },
  });

  return NextResponse.json({
    orchestration: orch
      ? {
          id: orch.id,
          productionNumber: orch.productionNumber,
          status: orch.status,
          estimateId: orch.estimateId,
          acceptedAt: orch.acceptedAt?.toISOString() ?? null,
          acceptedBy: orch.acceptedBy,
          constructorType: orch.constructorType,
          constructorUser: orch.constructorUser,
          constructorExternalName: orch.constructorExternalName,
          constructorExternalPhone: orch.constructorExternalPhone,
          constructorExternalEmail: orch.constructorExternalEmail,
          externalWorkspaceToken: orch.externalWorkspaceToken,
          productionNotes: orch.productionNotes,
          designStatus: orch.designStatus,
          procurementStatus: orch.procurementStatus,
          giblabStatus: orch.giblabStatus,
          giblabExportStatus: orch.giblabExportStatus,
          dueDate: orch.dueDate?.toISOString() ?? null,
          riskLevel: orch.riskLevel,
          designLockedAt: orch.designLockedAt?.toISOString() ?? null,
          updatedAt: orch.updatedAt.toISOString(),
        }
      : null,
    clarifications,
  });
}
