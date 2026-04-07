import { Role } from "@prisma/client";

/** Ролі, яких можна призначати відповідальними за лід (вибір «менеджер»). */
export const LEAD_ASSIGNABLE_MANAGER_ROLES: Role[] = [
  Role.MANAGER,
  Role.HEAD_MANAGER,
  Role.SALES_MANAGER,
];

export function isLeadAssignableManagerRole(role: Role): boolean {
  return LEAD_ASSIGNABLE_MANAGER_ROLES.includes(role);
}
