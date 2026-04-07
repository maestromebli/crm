import { hasEffectivePermission, P } from "../authz/permissions";

export type EstimateJson = Record<string, unknown>;

type AuthzCtx = { realRole: string; impersonatorId?: string | null };

/** Приховує собівартість / маржу без відповідних прав. */
export function serializeEstimateForClient(
  row: EstimateJson,
  permissionKeys: string[],
  authz: AuthzCtx,
): EstimateJson {
  const canCost = hasEffectivePermission(
    permissionKeys,
    P.COST_VIEW,
    authz,
  );
  const canMargin = hasEffectivePermission(
    permissionKeys,
    P.MARGIN_VIEW,
    authz,
  );
  const lineItems = Array.isArray(row.lineItems)
    ? (row.lineItems as EstimateJson[]).map((li) => {
        const next = { ...li };
        if (!canCost) {
          delete next.costPrice;
          delete next.amountCost;
        }
        if (!canMargin) {
          delete next.margin;
        }
        return next;
      })
    : row.lineItems;

  const out: EstimateJson = { ...row, lineItems };
  if (!canCost) {
    delete out.totalCost;
  }
  if (!canMargin) {
    delete out.grossMargin;
  }
  return out;
}
