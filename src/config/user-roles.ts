/** Відповідає `enum Role` у prisma/schema.prisma (для UI без імпорту Prisma на клієнті). */
export const CRM_ROLES_PRIMARY = [
  "SUPER_ADMIN",
  "ADMIN",
  "DIRECTOR",
  "DIRECTOR_PRODUCTION",
  "HEAD_MANAGER",
  "TEAM_LEAD",
  "SALES_MANAGER",
  "MEASURER",
  "PRODUCTION_WORKER",
  "PROCUREMENT_MANAGER",
  "ACCOUNTANT",
] as const;

/** Ролі для сумісності зі старими записами / міграціями. */
export const CRM_ROLES_LEGACY = ["MANAGER", "USER"] as const;

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
  TEAM_LEAD: "Тімлід",
  SALES_MANAGER: "Менеджер з продажів",
  MEASURER: "Замірник",
  PRODUCTION_WORKER: "Виробництво",
  PROCUREMENT_MANAGER: "Закупівлі",
  ACCOUNTANT: "Бухгалтер",
  DIRECTOR: "Директор",
  DIRECTOR_PRODUCTION: "Директор виробництва",
  MANAGER: "Менеджер (legacy → як головний менеджер)",
  USER: "Користувач (legacy → як менеджер з продажів)",
};
