import type { SessionUser } from "../../../lib/authz/api-guard";
import { hasEffectivePermission, P } from "../../../lib/authz/permissions";

function permCtx(user: SessionUser) {
  return {
    realRole: user.realRole,
    impersonatorId: user.impersonatorId,
  };
}

export function aiUserRoleLabel(user: SessionUser): string {
  const r = user.realRole ?? user.dbRole;
  switch (r) {
    case "SUPER_ADMIN":
    case "DIRECTOR":
      return "director_or_admin";
    case "HEAD_MANAGER":
      return "head_manager";
    case "SALES_MANAGER":
    case "USER":
      return "sales_manager";
    default:
      return "other";
  }
}

export function canViewPaymentsInAi(user: SessionUser): boolean {
  return hasEffectivePermission(user.permissionKeys, P.PAYMENTS_VIEW, permCtx(user));
}

export function canViewCostInAi(user: SessionUser): boolean {
  return hasEffectivePermission(user.permissionKeys, P.COST_VIEW, permCtx(user));
}

export function canViewMarginInAi(user: SessionUser): boolean {
  return hasEffectivePermission(user.permissionKeys, P.MARGIN_VIEW, permCtx(user));
}
