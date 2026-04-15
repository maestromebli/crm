import { P, hasAnyPermission, isAdminLikeScope } from "@/lib/authz/permissions";

type ProductionAuthActor = {
  dbRole: string;
  realRole: string;
  permissionKeys: string[];
};

function hasRoleAccess(user: ProductionAuthActor): boolean {
  if (user.realRole === "DIRECTOR_PRODUCTION" || user.dbRole === "DIRECTOR_PRODUCTION") {
    return true;
  }
  return isAdminLikeScope({
    realRole: user.realRole,
    dbRole: user.dbRole,
  });
}

export function canViewProduction(user: ProductionAuthActor): boolean {
  if (hasRoleAccess(user)) return true;
  return hasAnyPermission(user.permissionKeys, [
    P.PRODUCTION_ORDERS_VIEW,
    P.PRODUCTION_ORDERS_MANAGE,
    P.PRODUCTION_LAUNCH,
    P.DEALS_VIEW,
  ]);
}

export function canManageProduction(user: ProductionAuthActor): boolean {
  if (hasRoleAccess(user)) return true;
  return hasAnyPermission(user.permissionKeys, [P.PRODUCTION_ORDERS_MANAGE, P.PRODUCTION_LAUNCH]);
}
