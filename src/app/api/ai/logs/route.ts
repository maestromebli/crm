import { NextResponse } from "next/server";
import { requireSessionUser } from "../../../../lib/authz/api-guard";
import { hasEffectivePermission, P } from "../../../../lib/authz/permissions";
import { requireDatabaseUrl } from "../../../../lib/api/route-guards";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const dbNotReady = requireDatabaseUrl();
  if (dbNotReady) return dbNotReady;

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const ctx = { realRole: user.realRole, impersonatorId: user.impersonatorId };
  const allowed =
    hasEffectivePermission(user.permissionKeys, P.AUDIT_LOG_VIEW, ctx) ||
    hasEffectivePermission(user.permissionKeys, P.SETTINGS_MANAGE, ctx) ||
    hasEffectivePermission(user.permissionKeys, P.AI_ANALYTICS, ctx);

  if (!allowed) {
    return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    100,
    Math.max(1, Number(searchParams.get("limit") ?? "40") || 40),
  );

  const rows = await prisma.aiAssistantLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      model: true,
      ok: true,
      errorMessage: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ items: rows });
}
