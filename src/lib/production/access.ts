import type { Role } from "@prisma/client";
import type { Session } from "next-auth";
import {
  hasEffectivePermission,
  hasAnyPermission,
  P,
  type Phase1Permission,
} from "../authz/permissions";

export type ProductionAccessRole =
  | "admin"
  | "team_lead"
  | "worker"
  | "sales_view"
  | "none";

export function productionAccessFromSession(session: Session): ProductionAccessRole {
  const role = session.user.role as Role;
  if (role === "SUPER_ADMIN" || role === "ADMIN") return "admin";
  if (role === "TEAM_LEAD" || role === "HEAD_MANAGER" || role === "MANAGER")
    return "team_lead";
  if (role === "PRODUCTION_WORKER") return "worker";
  if (role === "SALES_MANAGER") return "sales_view";
  if (
    hasEffectivePermission(session.user.permissionKeys ?? [], P.PRODUCTION_ORDERS_MANAGE, {
      realRole: session.user.realRole,
      impersonatorId: session.user.impersonatorId,
    })
  ) {
    return "team_lead";
  }
  if (
    hasEffectivePermission(session.user.permissionKeys ?? [], P.PRODUCTION_ORDERS_VIEW, {
      realRole: session.user.realRole,
      impersonatorId: session.user.impersonatorId,
    })
  ) {
    return "sales_view";
  }
  if (
    hasEffectivePermission(session.user.permissionKeys ?? [], P.PRODUCTION_LAUNCH, {
      realRole: session.user.realRole,
      impersonatorId: session.user.impersonatorId,
    })
  ) {
    return "team_lead";
  }
  return "none";
}

export function canManageProductionOrders(session: Session): boolean {
  const r = productionAccessFromSession(session);
  return r === "admin" || r === "team_lead";
}

export function canViewProductionModule(session: Session): boolean {
  const r = productionAccessFromSession(session);
  return r !== "none" && r !== "worker";
}

/** Kanban / routes: workers see обрізаний режим (призначені задачі). */
export function canAccessProductionRoutes(session: Session): boolean {
  return productionAccessFromSession(session) !== "none";
}

/** Worker: only assigned tasks / orders where they have tasks. */
export function isProductionWorkerOnly(session: Session): boolean {
  return productionAccessFromSession(session) === "worker";
}

export function requireProductionPermissions(
  session: Session,
  need: "view" | "manage",
): boolean {
  if (need === "manage") {
    return canManageProductionOrders(session);
  }
  return (
    canViewProductionModule(session) ||
    isProductionWorkerOnly(session) ||
    canManageProductionOrders(session)
  );
}

export function pagePermissionsForProduction(): Phase1Permission[] {
  return [P.PRODUCTION_ORDERS_VIEW, P.PRODUCTION_ORDERS_MANAGE, P.PRODUCTION_LAUNCH, P.DEALS_VIEW];
}

export function sessionHasAnyProductionPagePermission(session: Session): boolean {
  return hasAnyPermission(session.user.permissionKeys ?? [], [
    P.PRODUCTION_ORDERS_VIEW,
    P.PRODUCTION_ORDERS_MANAGE,
    P.PRODUCTION_LAUNCH,
    P.DEALS_VIEW,
  ]);
}
