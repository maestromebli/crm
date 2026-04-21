import { prisma } from "../prisma";
import { resolveAccessContext, type AccessContext } from "./data-scope";
import { normalizeRole, type EffectiveRole } from "./roles";
import type { SessionUser } from "./api-guard";
import { getCachedServerSession } from "./server-session";

export type SessionAccess = {
  userId: string;
  ctx: AccessContext;
  role: EffectiveRole;
  dbRole: string;
  permissionKeys: string[];
  realRole: string;
  impersonatorId?: string;
};

export function sessionUserFromAccess(a: SessionAccess): SessionUser {
  return {
    id: a.userId,
    role: a.role,
    dbRole: a.dbRole,
    permissionKeys: a.permissionKeys,
    realRole: a.realRole,
    impersonatorId: a.impersonatorId,
  };
}

/** Для RSC: сесія + контекст видимості даних за роллю. */
export async function getSessionAccess(): Promise<SessionAccess | null> {
  const session = await getCachedServerSession();
  if (!session?.user?.id) return null;
  const ctx = await resolveAccessContext(prisma, session.user);
  return {
    userId: session.user.id,
    ctx,
    role: normalizeRole(session.user.role),
    dbRole: session.user.role,
    permissionKeys: session.user.permissionKeys ?? [],
    realRole: session.user.realRole ?? session.user.role,
    impersonatorId: session.user.impersonatorId,
  };
}
