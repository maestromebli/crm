import { canViewProduction } from "@/features/production/server/permissions/production-permissions";
import type { ConstructorHubRole } from "./constructor-hub.types";

type SessionLikeUser = {
  id: string;
  role: string;
  realRole?: string | null;
  permissionKeys?: string[] | null;
};

const elevatedRoles = new Set<string>([
  "SUPER_ADMIN",
  "ADMIN",
  "DIRECTOR",
  "DIRECTOR_PRODUCTION",
  "HEAD_MANAGER",
  "TEAM_LEAD",
  "PROCUREMENT_MANAGER",
]);

const constructorRoles = new Set<string>([
  "CONSTRUCTOR",
  "OUTSOURCE_CONSTRUCTOR",
  "PRODUCTION_WORKER",
]);

export function resolveConstructorHubRole(user: SessionLikeUser): ConstructorHubRole {
  const role = user.realRole ?? user.role;
  if (role === "SUPER_ADMIN" || role === "ADMIN") return "ADMIN";
  if (role === "DIRECTOR" || role === "DIRECTOR_PRODUCTION") return "DIRECTOR";
  if (role === "HEAD_MANAGER" || role === "TEAM_LEAD") return "HEAD_OF_PRODUCTION";
  if (role === "PROCUREMENT_MANAGER") return "PRODUCTION_MANAGER";
  if (role === "OUTSOURCE_CONSTRUCTOR") return "OUTSOURCE_CONSTRUCTOR";
  return "CONSTRUCTOR";
}

export function canEnterConstructorHub(user: SessionLikeUser): boolean {
  if (
    canViewProduction({
      dbRole: user.role,
      realRole: user.realRole ?? user.role,
      permissionKeys: user.permissionKeys ?? [],
    })
  ) {
    return true;
  }
  const role = user.realRole ?? user.role;
  return constructorRoles.has(role);
}

export function mustBeAssignedForScope(user: SessionLikeUser): boolean {
  const role = user.realRole ?? user.role;
  return !elevatedRoles.has(role);
}
