/**
 * Нормалізація ролей етапу 1 + сумісність з legacy enum у БД.
 */

export type EffectiveRole =
  | "SUPER_ADMIN"
  | "DIRECTOR"
  | "DIRECTOR_PRODUCTION"
  | "HEAD_MANAGER"
  | "TEAM_LEAD"
  | "SALES_MANAGER"
  | "MEASURER"
  | "ACCOUNTANT"
  | "PROCUREMENT_MANAGER";

/**
 * ADMIN → DIRECTOR, MANAGER → HEAD_MANAGER, USER → SALES_MANAGER.
 */
export function normalizeRole(role: string): EffectiveRole {
  switch (role) {
    case "SUPER_ADMIN":
      return "SUPER_ADMIN";
    case "DIRECTOR":
    case "ADMIN":
      return "DIRECTOR";
    case "DIRECTOR_PRODUCTION":
      return "DIRECTOR_PRODUCTION";
    case "HEAD_MANAGER":
    case "MANAGER":
      return "HEAD_MANAGER";
    case "TEAM_LEAD":
      return "TEAM_LEAD";
    case "SALES_MANAGER":
    case "USER":
      return "SALES_MANAGER";
    case "MEASURER":
      return "MEASURER";
    case "ACCOUNTANT":
      return "ACCOUNTANT";
    case "PROCUREMENT_MANAGER":
      return "PROCUREMENT_MANAGER";
    default:
      return "SALES_MANAGER";
  }
}

/** Повний доступ до даних по компанії (ліди/угоди без фільтра власника). */
export function hasUnrestrictedDataScope(role: EffectiveRole): boolean {
  return role === "SUPER_ADMIN" || role === "DIRECTOR" || role === "DIRECTOR_PRODUCTION";
}

/**
 * Може призначати задачі не лише собі (керівник лінії продажів + керівництво).
 */
export function hasTaskAssignScope(role: EffectiveRole): boolean {
  return (
    role === "SUPER_ADMIN" ||
    role === "DIRECTOR" ||
    role === "DIRECTOR_PRODUCTION" ||
    role === "HEAD_MANAGER" ||
    role === "TEAM_LEAD"
  );
}

/** Ролі з операційним контуром продажів (не замірник / бухгалтерія). */
export function isSalesPipelineRole(role: EffectiveRole): boolean {
  return (
    role === "SUPER_ADMIN" ||
    role === "DIRECTOR" ||
    role === "DIRECTOR_PRODUCTION" ||
    role === "HEAD_MANAGER" ||
    role === "TEAM_LEAD" ||
    role === "SALES_MANAGER"
  );
}

/** Виробництво / закупівлі — загальний операційний зріз (не лише «свої» угоди). */
export function hasCompanyOperationsScope(role: EffectiveRole): boolean {
  return (
    role === "SUPER_ADMIN" ||
    role === "DIRECTOR" ||
    role === "DIRECTOR_PRODUCTION" ||
    role === "TEAM_LEAD" ||
    role === "PROCUREMENT_MANAGER" ||
    role === "ACCOUNTANT"
  );
}

export type ExecutiveLayoutMode = "full" | "team_lead" | "sales" | "measurer";

export function getExecutiveLayoutMode(role: EffectiveRole): ExecutiveLayoutMode {
  if (role === "MEASURER") return "measurer";
  if (role === "SALES_MANAGER") return "sales";
  if (role === "TEAM_LEAD") return "team_lead";
  return "full";
}
