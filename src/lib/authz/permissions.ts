/**
 * Етап 1: канонічні ключі = Prisma `PermissionKey` (UPPER_SNAKE_CASE).
 * {@link LEGACY_ALIASES} дозволяє старим рядкам у `PermissionOnUser` задовольняти нові перевірки.
 */

export const P = {
  DASHBOARD_VIEW: "DASHBOARD_VIEW",
  CALENDAR_VIEW: "CALENDAR_VIEW",
  REPORTS_VIEW: "REPORTS_VIEW",
  REPORTS_EXPORT: "REPORTS_EXPORT",
  LEADS_VIEW: "LEADS_VIEW",
  LEADS_CREATE: "LEADS_CREATE",
  LEADS_UPDATE: "LEADS_UPDATE",
  LEADS_ASSIGN: "LEADS_ASSIGN",
  DEALS_VIEW: "DEALS_VIEW",
  DEALS_CREATE: "DEALS_CREATE",
  DEALS_UPDATE: "DEALS_UPDATE",
  DEALS_ASSIGN: "DEALS_ASSIGN",
  DEALS_STAGE_CHANGE: "DEALS_STAGE_CHANGE",
  TASKS_VIEW: "TASKS_VIEW",
  TASKS_CREATE: "TASKS_CREATE",
  TASKS_UPDATE: "TASKS_UPDATE",
  TASKS_ASSIGN: "TASKS_ASSIGN",
  FILES_VIEW: "FILES_VIEW",
  FILES_UPLOAD: "FILES_UPLOAD",
  FILES_DELETE: "FILES_DELETE",
  ESTIMATES_VIEW: "ESTIMATES_VIEW",
  ESTIMATES_CREATE: "ESTIMATES_CREATE",
  ESTIMATES_UPDATE: "ESTIMATES_UPDATE",
  QUOTES_CREATE: "QUOTES_CREATE",
  CONTRACTS_VIEW: "CONTRACTS_VIEW",
  CONTRACTS_CREATE: "CONTRACTS_CREATE",
  CONTRACTS_UPDATE: "CONTRACTS_UPDATE",
  PAYMENTS_VIEW: "PAYMENTS_VIEW",
  PAYMENTS_UPDATE: "PAYMENTS_UPDATE",
  COST_VIEW: "COST_VIEW",
  MARGIN_VIEW: "MARGIN_VIEW",
  SETTINGS_VIEW: "SETTINGS_VIEW",
  SETTINGS_MANAGE: "SETTINGS_MANAGE",
  USERS_VIEW: "USERS_VIEW",
  USERS_MANAGE: "USERS_MANAGE",
  ROLES_MANAGE: "ROLES_MANAGE",
  AUDIT_LOG_VIEW: "AUDIT_LOG_VIEW",
  CONTACTS_VIEW: "CONTACTS_VIEW",
  DEAL_WORKSPACE_VIEW: "DEAL_WORKSPACE_VIEW",
  NOTIFICATIONS_VIEW: "NOTIFICATIONS_VIEW",
  HANDOFF_SUBMIT: "HANDOFF_SUBMIT",
  HANDOFF_ACCEPT: "HANDOFF_ACCEPT",
  PRODUCTION_LAUNCH: "PRODUCTION_LAUNCH",
  PRODUCTION_ORDERS_VIEW: "PRODUCTION_ORDERS_VIEW",
  PRODUCTION_ORDERS_MANAGE: "PRODUCTION_ORDERS_MANAGE",
  PRODUCTION_ORCHESTRATION_VIEW: "PRODUCTION_ORCHESTRATION_VIEW",
  PRODUCTION_ORCHESTRATION_MANAGE: "PRODUCTION_ORCHESTRATION_MANAGE",
  AI_USE: "AI_USE",
  AI_ANALYTICS: "AI_ANALYTICS",
} as const;

export type Phase1Permission = (typeof P)[keyof typeof P];

/** Новий ключ → старі ключі з БД, що також зараховуються. */
const LEGACY_ALIASES: Partial<Record<Phase1Permission, readonly string[]>> = {
  [P.CONTRACTS_VIEW]: ["CONTRACT_VIEW"],
  [P.CONTRACTS_CREATE]: ["CONTRACT_EDIT"],
  [P.CONTRACTS_UPDATE]: ["CONTRACT_EDIT"],
  [P.FILES_UPLOAD]: ["FILE_UPLOAD"],
  [P.FILES_DELETE]: ["FILE_DELETE"],
  [P.DEALS_VIEW]: ["DEAL_WORKSPACE_VIEW"],
  /** Створення замовлення з ліда — той самий доступ, що й робоче місце замовлення. */
  [P.DEALS_CREATE]: ["DEAL_WORKSPACE_VIEW"],
  /** Перехідний період: workspace раніше був основним «редагуванням» замовлення. */
  [P.DEALS_UPDATE]: ["DEAL_WORKSPACE_VIEW"],
  [P.DEALS_STAGE_CHANGE]: ["DEAL_WORKSPACE_VIEW"],
  [P.HANDOFF_ACCEPT]: ["HANDOFF_SUBMIT"],
  [P.PAYMENTS_UPDATE]: ["PAYMENT_CONFIRM"],
  [P.PRODUCTION_ORDERS_MANAGE]: ["PRODUCTION_LAUNCH"],
  [P.PRODUCTION_ORDERS_VIEW]: ["PRODUCTION_LAUNCH", "DEALS_VIEW"],
  [P.PRODUCTION_ORCHESTRATION_VIEW]: ["PRODUCTION_LAUNCH", "DEALS_VIEW", "HANDOFF_SUBMIT"],
  [P.PRODUCTION_ORCHESTRATION_MANAGE]: ["PRODUCTION_LAUNCH", "HANDOFF_ACCEPT"],
};

export function hasPermission(
  granted: string[] | undefined,
  required: Phase1Permission,
): boolean {
  const keys = granted ?? [];
  if (keys.includes(required)) return true;
  const aliases = LEGACY_ALIASES[required];
  if (!aliases) return false;
  return aliases.some((a) => keys.includes(a));
}

export function hasAnyPermission(
  granted: string[] | undefined,
  required: Phase1Permission[],
): boolean {
  return required.some((r) => hasPermission(granted, r));
}

/**
 * Ураховує імпersonацію: SUPER_ADMIN/ADMIN/DIRECTOR без активної імпersonації проходять усі перевірки.
 * `impersonatorId` у сесії = id того, хто увійшов, коли показуємо іншого користувача.
 */
export function hasEffectivePermission(
  granted: string[] | undefined,
  required: Phase1Permission,
  ctx: {
    realRole?: string;
    impersonatorId?: string | null;
  },
): boolean {
  if (hasUnrestrictedPermissionScope(ctx)) {
    return true;
  }
  return hasPermission(granted, required);
}

export function hasEffectiveAnyPermission(
  granted: string[] | undefined,
  required: Phase1Permission[],
  ctx: {
    realRole?: string;
    impersonatorId?: string | null;
  },
): boolean {
  return required.some((key) =>
    hasEffectivePermission(granted, key, ctx),
  );
}

export function hasUnrestrictedPermissionScope(ctx: {
  realRole?: string;
  impersonatorId?: string | null;
}): boolean {
  const impersonating = Boolean(ctx.impersonatorId);
  if (impersonating) return false;
  return (
    ctx.realRole === "SUPER_ADMIN" ||
    ctx.realRole === "ADMIN" ||
    ctx.realRole === "DIRECTOR"
  );
}

export function canDeleteLeadByRole(ctx: {
  realRole?: string;
  dbRole?: string;
}): boolean {
  return (
    ctx.realRole === "HEAD_MANAGER" ||
    ctx.realRole === "ADMIN" ||
    ctx.realRole === "DIRECTOR" ||
    ctx.realRole === "SUPER_ADMIN" ||
    ctx.dbRole === "MANAGER"
  );
}

export function canAssignSuperAdminRole(ctx: {
  realRole?: string;
}): boolean {
  return ctx.realRole === "SUPER_ADMIN";
}

export function isAdminLikeScope(ctx: {
  realRole?: string;
  dbRole?: string;
}): boolean {
  return (
    ctx.realRole === "SUPER_ADMIN" ||
    ctx.dbRole === "SUPER_ADMIN" ||
    ctx.dbRole === "ADMIN" ||
    ctx.dbRole === "DIRECTOR" ||
    ctx.realRole === "DIRECTOR_PRODUCTION" ||
    ctx.dbRole === "DIRECTOR_PRODUCTION"
  );
}
