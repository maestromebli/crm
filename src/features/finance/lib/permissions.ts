import { P, hasEffectivePermission, type Phase1Permission } from "../../../lib/authz/permissions";
import type { SessionUser } from "../../../lib/authz/api-guard";

/**
 * Дії модуля фінансів → існуючі Prisma P.* (без окремої міграції PermissionKey).
 */
export type FinanceAction =
  | "finance.view"
  | "finance.transaction.create"
  | "finance.transaction.approve"
  | "finance.transaction.export"
  /** Уточнення до карток executive KPI (PostgreSQL), без права створювати платежі. */
  | "finance.kpi.notes.edit"
  | "finance.payroll.manage"
  | "finance.commission.manage"
  | "finance.receivables.view"
  | "finance.payables.view";

const ACTION_TO_PERMISSION: Record<FinanceAction, Phase1Permission[]> = {
  "finance.view": [P.REPORTS_VIEW, P.MARGIN_VIEW, P.COST_VIEW],
  "finance.transaction.create": [P.PAYMENTS_UPDATE, P.DEALS_UPDATE],
  "finance.transaction.approve": [P.PAYMENTS_UPDATE],
  "finance.transaction.export": [P.REPORTS_EXPORT, P.REPORTS_VIEW],
  "finance.kpi.notes.edit": [P.MARGIN_VIEW, P.REPORTS_VIEW, P.COST_VIEW],
  "finance.payroll.manage": [P.PAYMENTS_UPDATE, P.MARGIN_VIEW],
  "finance.commission.manage": [P.PAYMENTS_UPDATE, P.MARGIN_VIEW],
  "finance.receivables.view": [P.PAYMENTS_VIEW, P.REPORTS_VIEW],
  "finance.payables.view": [P.COST_VIEW, P.REPORTS_VIEW],
};

function can(user: SessionUser, keys: Phase1Permission[]): boolean {
  return keys.some((k) =>
    hasEffectivePermission(user.permissionKeys, k, {
      realRole: user.realRole,
      impersonatorId: user.impersonatorId,
    }),
  );
}

export function canFinanceAction(user: SessionUser, action: FinanceAction): boolean {
  return can(user, ACTION_TO_PERMISSION[action]);
}

export function buildFinanceCapabilityMap(user: SessionUser): Record<FinanceAction, boolean> {
  return {
    "finance.view": canFinanceAction(user, "finance.view"),
    "finance.transaction.create": canFinanceAction(user, "finance.transaction.create"),
    "finance.transaction.approve": canFinanceAction(user, "finance.transaction.approve"),
    "finance.transaction.export": canFinanceAction(user, "finance.transaction.export"),
    "finance.kpi.notes.edit": canFinanceAction(user, "finance.kpi.notes.edit"),
    "finance.payroll.manage": canFinanceAction(user, "finance.payroll.manage"),
    "finance.commission.manage": canFinanceAction(user, "finance.commission.manage"),
    "finance.receivables.view": canFinanceAction(user, "finance.receivables.view"),
    "finance.payables.view": canFinanceAction(user, "finance.payables.view"),
  };
}
