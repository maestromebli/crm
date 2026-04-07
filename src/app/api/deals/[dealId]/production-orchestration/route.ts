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

  const flow = await prisma.productionFlow.findUnique({
    where: { dealId },
    include: {
      chiefUser: { select: { id: true, name: true, email: true } },
    },
  });

  const clarifications = flow
    ? await prisma.productionQuestion.findMany({
        where: { flowId: flow.id, source: "HANDOFF" },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          status: true,
          text: true,
          createdAt: true,
          answeredAt: true,
        },
      })
    : [];

  return NextResponse.json({
    orchestration: flow
      ? {
          id: flow.id,
          productionNumber: flow.number,
          status: flow.status,
          estimateId: null,
          acceptedAt: flow.acceptedAt?.toISOString() ?? null,
          acceptedBy: flow.chiefUser,
          constructorType:
            flow.constructorMode === "INTERNAL"
              ? "INTERNAL"
              : flow.constructorMode === "OUTSOURCE"
                ? "OUTSOURCED"
                : null,
          constructorUser: flow.chiefUser,
          constructorExternalName: flow.constructorName,
          constructorExternalPhone: null,
          constructorExternalEmail: null,
          externalWorkspaceToken: flow.constructorWorkspaceUrl,
          productionNotes: flow.productSummary,
          designStatus: null,
          procurementStatus: null,
          giblabStatus: null,
          giblabExportStatus: null,
          dueDate: flow.dueDate?.toISOString() ?? null,
          riskLevel: null,
          designLockedAt: null,
          updatedAt: flow.updatedAt.toISOString(),
        }
      : null,
    clarifications: clarifications.map((c) => ({
      id: c.id,
      status: c.status,
      issuesJson: [],
      messageToManager: c.text,
      createdAt: c.createdAt.toISOString(),
      resolvedAt: c.answeredAt?.toISOString() ?? null,
    })),
  });
}
