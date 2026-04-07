import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/options";
import { prisma } from "../prisma";
import { normalizeRole, type EffectiveRole } from "./roles";
import {
  hasEffectivePermission,
  type Phase1Permission,
} from "./permissions";
import {
  canAccessLead,
  canAccessOwner,
  resolveAccessContext,
} from "./data-scope";

export type SessionUser = {
  id: string;
  role: EffectiveRole;
  /** Ефективна роль (цільовий користувач при імпersonації). */
  dbRole: string;
  permissionKeys: string[];
  /** Роль облікового запису після логіну. */
  realRole: string;
  impersonatorId?: string;
};

export async function requireSessionUser(): Promise<
  SessionUser | NextResponse
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Потрібна авторизація" },
      { status: 401 },
    );
  }
  return {
    id: session.user.id,
    role: normalizeRole(session.user.role),
    dbRole: session.user.role,
    permissionKeys: session.user.permissionKeys ?? [],
    realRole: session.user.realRole ?? session.user.role,
    impersonatorId: session.user.impersonatorId,
  };
}

export function forbidUnlessPermission(
  user: SessionUser,
  permission: Phase1Permission,
): NextResponse | null {
  if (
    !hasEffectivePermission(user.permissionKeys, permission, {
      realRole: user.realRole,
      impersonatorId: user.impersonatorId,
    })
  ) {
    return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
  }
  return null;
}

/**
 * Перевірка права + scope власника угоди (SALES_MANAGER — свої; HEAD_MANAGER — лінія продажів).
 */
export async function forbidUnlessDealAccess(
  user: SessionUser,
  permission: Phase1Permission,
  deal: { ownerId: string },
): Promise<NextResponse | null> {
  const perm = forbidUnlessPermission(user, permission);
  if (perm) return perm;
  const ctx = await resolveAccessContext(prisma, {
    id: user.id,
    role: user.dbRole,
  });
  if (!canAccessOwner(ctx, deal.ownerId)) {
    // Hide deal existence outside the caller's scope.
    return NextResponse.json(
      { error: "Угоду не знайдено" },
      { status: 404 },
    );
  }
  return null;
}

export async function forbidUnlessLeadAccess(
  user: SessionUser,
  permission: Phase1Permission,
  lead: { id: string; ownerId: string },
): Promise<NextResponse | null> {
  const perm = forbidUnlessPermission(user, permission);
  if (perm) return perm;
  const ctx = await resolveAccessContext(prisma, {
    id: user.id,
    role: user.dbRole,
  });
  if (!canAccessLead(ctx, lead)) {
    // Hide lead existence outside the caller's scope.
    return NextResponse.json(
      { error: "Лід не знайдено" },
      { status: 404 },
    );
  }
  return null;
}
