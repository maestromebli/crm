import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "../auth/options";
import {
  hasEffectivePermission,
  type Phase1Permission,
  P,
} from "./permissions";

/**
 * RSC layout CRM: сесія обовʼязкова (дубль до middleware).
 */
export async function requireSessionForAppLayout() {
  const session = await getServerSession(authOptions);
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
