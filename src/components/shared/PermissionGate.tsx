"use client";

import type { ReactNode } from "react";
import { useSession } from "next-auth/react";
import {
  hasEffectivePermission,
  type Phase1Permission,
} from "../../lib/authz/permissions";

type PermissionGateProps = {
  children: ReactNode;
  fallback?: ReactNode;
  /** Якщо не задано — достатньо бути автентифікованим. */
  permission?: Phase1Permission;
};

export function PermissionGate({
  children,
  fallback = null,
  permission,
}: PermissionGateProps) {
  const { data, status } = useSession();

  if (status === "loading") {
    return null;
  }

  if (status === "unauthenticated") {
    return <>{fallback}</>;
  }

  if (permission) {
    const keys = data?.user?.permissionKeys ?? [];
    if (
      !hasEffectivePermission(keys, permission, {
        realRole: data?.user?.realRole,
        impersonatorId: data?.user?.impersonatorId,
      })
    ) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}
