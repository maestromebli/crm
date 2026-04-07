/** Відповідає `enum Role` у prisma/schema.prisma (для UI без імпорту Prisma на клієнті). */
export const CRM_ROLES_PRIMARY = [
  "SUPER_ADMIN",
  "ADMIN",
  "HEAD_MANAGER",
  "SALES_MANAGER",
] as const;

/** Ролі для сумісності зі старими записами / міграціями. */
export const CRM_ROLES_LEGACY = ["DIRECTOR", "MANAGER", "USER"] as const;

export const CRM_ROLES = [
  ...CRM_ROLES_PRIMARY,
  ...CRM_ROLES_LEGACY,
] as const;

export type CrmRole = (typeof CRM_ROLES)[number];

/**
 * Підписи узгоджені з політикою `src/lib/authz/role-access-policy.ts`.
 */
export const ROLE_LABELS: Record<CrmRole, string> = {
  SUPER_ADMIN: "Адміністратор (повний доступ)",
  ADMIN: "Адміністратор (операційний)",
  HEAD_MANAGER: "Головний менеджер",
  SALES_MANAGER: "Менеджер з продажів",
  DIRECTOR: "Директор",
  MANAGER: "Менеджер (legacy → як головний менеджер)",
  USER: "Користувач (legacy → як менеджер з продажів)",
};
