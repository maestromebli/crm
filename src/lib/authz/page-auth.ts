import { redirect } from "next/navigation";
import {
  hasEffectivePermission,
  type Phase1Permission,
  P,
} from "./permissions";
import { getCachedServerSession } from "./server-session";

/**
 * RSC layout CRM: сесія обовʼязкова (дубль до middleware).
 */
export async function requireSessionForAppLayout() {
  const session = await getCachedServerSession();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session;
}

export async function requirePermissionForPage(permission: Phase1Permission) {
  const session = await requireSessionForAppLayout();
  if (
    !hasEffectivePermission(session.user.permissionKeys, permission, {
      realRole: session.user.realRole,
      impersonatorId: session.user.impersonatorId,
    })
  ) {
    redirect("/access-denied");
  }
  return session;
}

export { P };
