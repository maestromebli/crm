import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { hasEffectivePermission, P } from "@/lib/authz/permissions";
import { loadEventHealthSnapshot } from "@/lib/events/event-health";

export async function GET() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const permCtx = {
    realRole: user.realRole,
    impersonatorId: user.impersonatorId,
  };
  const canView =
    hasEffectivePermission(user.permissionKeys, P.AUDIT_LOG_VIEW, permCtx) ||
    hasEffectivePermission(user.permissionKeys, P.SETTINGS_VIEW, permCtx);
  if (!canView) {
    return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
  }

  try {
    const snapshot = await loadEventHealthSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Помилка сервера";
    console.error("[api/crm/event-health]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
