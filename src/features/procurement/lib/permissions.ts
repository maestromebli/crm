import {
  P,
  hasEffectivePermission,
  hasUnrestrictedPermissionScope,
  type Phase1Permission,
} from "../../../lib/authz/permissions";
import type { SessionUser } from "../../../lib/authz/api-guard";

export type ProcurementAction =
  | "procurement.view"
  | "procurement.request.create"
  | "procurement.request.approve"
  | "procurement.order.create"
  | "procurement.receipt.create"
  | "procurement.supplier.manage"
  | "procurement.budget.view"
  | "procurement.budget.override";

const ACTION_TO_PERMISSION: Record<ProcurementAction, Phase1Permission[]> = {
  "procurement.view": [P.REPORTS_VIEW, P.COST_VIEW],
  "procurement.request.create": [P.DEALS_UPDATE, P.COST_VIEW],
  "procurement.request.approve": [P.DEALS_UPDATE, P.COST_VIEW],
  "procurement.order.create": [P.DEALS_UPDATE, P.COST_VIEW],
  "procurement.receipt.create": [P.DEALS_UPDATE, P.COST_VIEW],
  "procurement.supplier.manage": [P.SETTINGS_MANAGE, P.COST_VIEW],
  "procurement.budget.view": [P.COST_VIEW, P.REPORTS_VIEW],
  "procurement.budget.override": [P.SETTINGS_MANAGE, P.DEALS_UPDATE],
};

function can(user: SessionUser, keys: Phase1Permission[]): boolean {
  return keys.some((k) =>
    hasEffectivePermission(user.permissionKeys, k, {
      realRole: user.realRole,
      impersonatorId: user.impersonatorId,
    }),
  );
}

export function canProcurementAction(user: SessionUser, action: ProcurementAction): boolean {
  if (
    hasUnrestrictedPermissionScope({
      realRole: user.realRole,
      impersonatorId: user.impersonatorId,
    })
  ) {
    return true;
  }
  if (
    action === "procurement.view" &&
    user.realRole !== "ACCOUNTANT" &&
    user.realRole !== "PROCUREMENT_MANAGER"
  ) {
    return false;
  }
  return can(user, ACTION_TO_PERMISSION[action]);
}

export function buildProcurementCapabilityMap(
  user: SessionUser,
): Record<ProcurementAction, boolean> {
  return {
    "procurement.view": canProcurementAction(user, "procurement.view"),
    "procurement.request.create": canProcurementAction(user, "procurement.request.create"),
    "procurement.request.approve": canProcurementAction(user, "procurement.request.approve"),
    "procurement.order.create": canProcurementAction(user, "procurement.order.create"),
    "procurement.receipt.create": canProcurementAction(user, "procurement.receipt.create"),
    "procurement.supplier.manage": canProcurementAction(user, "procurement.supplier.manage"),
    "procurement.budget.view": canProcurementAction(user, "procurement.budget.view"),
    "procurement.budget.override": canProcurementAction(user, "procurement.budget.override"),
  };
}
