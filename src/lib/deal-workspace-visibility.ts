import type { DealWorkspaceTabId } from "../features/deal-workspace/types";
import { hasEffectiveAnyPermission, hasEffectivePermission, P } from "./authz/permissions";

type DealWorkspaceAccessCtx = {
  permissionKeys: string[] | undefined;
  realRole?: string;
  impersonatorId?: string | null;
};

export function canViewDealWorkspaceTab(
  tab: DealWorkspaceTabId,
  ctx: DealWorkspaceAccessCtx,
): boolean {
  const permissionCtx = {
    realRole: ctx.realRole,
    impersonatorId: ctx.impersonatorId ?? undefined,
  };

  if (tab === "estimate") {
    return hasEffectivePermission(ctx.permissionKeys, P.ESTIMATES_VIEW, permissionCtx);
  }
  if (tab === "tasks") {
    return hasEffectivePermission(ctx.permissionKeys, P.TASKS_VIEW, permissionCtx);
  }
  if (tab === "files") {
    return hasEffectivePermission(ctx.permissionKeys, P.FILES_VIEW, permissionCtx);
  }
  if (tab === "contract") {
    return hasEffectivePermission(ctx.permissionKeys, P.CONTRACTS_VIEW, permissionCtx);
  }
  if (tab === "payment") {
    return hasEffectivePermission(ctx.permissionKeys, P.PAYMENTS_VIEW, permissionCtx);
  }
  if (tab === "finance") {
    return hasEffectiveAnyPermission(
      ctx.permissionKeys,
      [P.COST_VIEW, P.MARGIN_VIEW, P.PAYMENTS_VIEW, P.REPORTS_VIEW],
      permissionCtx,
    );
  }
  if (tab === "handoff") {
    return hasEffectiveAnyPermission(
      ctx.permissionKeys,
      [P.HANDOFF_SUBMIT, P.HANDOFF_ACCEPT],
      permissionCtx,
    );
  }
  if (tab === "production") {
    return hasEffectiveAnyPermission(
      ctx.permissionKeys,
      [
        P.PRODUCTION_LAUNCH,
        P.PRODUCTION_ORDERS_VIEW,
        P.PRODUCTION_ORDERS_MANAGE,
        P.DEALS_VIEW,
      ],
      permissionCtx,
    );
  }

  return true;
}

export function getVisibleDealWorkspaceTabs(
  ctx: DealWorkspaceAccessCtx,
  tabs: readonly DealWorkspaceTabId[],
): DealWorkspaceTabId[] {
  return tabs.filter((tab) => canViewDealWorkspaceTab(tab, ctx));
}
