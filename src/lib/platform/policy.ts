import { NextResponse } from "next/server";
import {
  forbidUnlessPermission,
  type SessionUser,
} from "@/lib/authz/api-guard";
import {
  hasEffectiveAnyPermission,
  type Phase1Permission,
} from "@/lib/authz/permissions";

export function enforcePolicy(
  user: SessionUser,
  permission: Phase1Permission,
): NextResponse | null {
  return forbidUnlessPermission(user, permission);
}

export function enforceAnyPolicy(
  user: SessionUser,
  permissions: Phase1Permission[],
): NextResponse | null {
  const ok = hasEffectiveAnyPermission(user.permissionKeys, permissions, {
    realRole: user.realRole,
    impersonatorId: user.impersonatorId,
  });
  if (ok) return null;
  return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
}

