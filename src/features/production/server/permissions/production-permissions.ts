import { P, hasAnyPermission } from "@/lib/authz/permissions";

type ProductionAuthActor = {
  dbRole: string;
  realRole: string;
  permissionKeys: string[];
};

function hasRoleAccess(user: ProductionAuthActor): boolean {
  return user.realRole === "SUPER_ADMIN" || user.dbRole === "ADMIN" || user.dbRole === "DIRECTOR";
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
