import { NextResponse } from "next/server";
import {
  forbidUnlessDealAccess,
  forbidUnlessLeadAccess,
  requireSessionUser,
} from "../../../../lib/authz/api-guard";
import { hasEffectivePermission, P } from "../../../../lib/authz/permissions";
import { requireDatabaseUrl } from "../../../../lib/api/route-guards";
import { prisma } from "../../../../lib/prisma";
import { logAiEvent } from "../../../../lib/ai/log-ai-event";
import { buildAiWorkspaceSnapshot } from "../../../../features/ai/workspace/build-workspace-snapshot";

export const runtime = "nodejs";

function canFetchWorkspace(user: {
  permissionKeys: string[];
  realRole: string;
  impersonatorId?: string;
}): boolean {
  const ctx = { realRole: user.realRole, impersonatorId: user.impersonatorId };
  return (
    hasEffectivePermission(user.permissionKeys, P.AI_USE, ctx) ||
    hasEffectivePermission(user.permissionKeys, P.LEADS_VIEW, ctx) ||
    hasEffectivePermission(user.permissionKeys, P.DEALS_VIEW, ctx) ||
    hasEffectivePermission(user.permissionKeys, P.DASHBOARD_VIEW, ctx)
  );
}

export async function GET(request: Request) {
  const dbNotReady = requireDatabaseUrl();
  if (dbNotReady) return dbNotReady;

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  if (!canFetchWorkspace(user)) {
    return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get("leadId")?.trim() || null;
  const dealId = searchParams.get("dealId")?.trim() || null;

  if ((!leadId && !dealId) || (leadId && dealId)) {
    return NextResponse.json(
      { error: "Вкажіть рівно один з параметрів: leadId або dealId" },
      { status: 400 },
    );
  }

  const ctx = { realRole: user.realRole, impersonatorId: user.impersonatorId };

  if (leadId) {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, ownerId: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
    }
    const denied = await forbidUnlessLeadAccess(user, P.LEADS_VIEW, lead);
    if (denied) return denied;
  }

  if (dealId) {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, ownerId: true },
    });
    if (!deal) {
      return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
    }
    const denied = await forbidUnlessDealAccess(user, P.DEALS_VIEW, deal);
    if (denied) return denied;
  }

  const showFinance = hasEffectivePermission(user.permissionKeys, P.PAYMENTS_VIEW, ctx);

  const snapshot = await buildAiWorkspaceSnapshot({
    leadId,
    dealId,
    showFinance,
  });

  if (!snapshot) {
    return NextResponse.json({ error: "Не вдалося зібрати контекст" }, {
      status: 404,
    });
  }

  await logAiEvent({
    userId: user.id,
    action: "workspace_snapshot",
    entityType: snapshot.entity.toUpperCase(),
    entityId: snapshot.entityId,
    ok: true,
    metadata: { stage: snapshot.stageLabel },
  });

  return NextResponse.json(snapshot);
}
