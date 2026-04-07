import type { Session } from "next-auth";
import { getProductionOrderHubView } from "../services/production-order-hub.service";
import { canViewProduction } from "../permissions/production-permissions";

export async function getProductionOrderHub(input: { session: Session; flowId: string }) {
  const user = input.session.user;
  const allowed = canViewProduction({
    dbRole: user.role,
    realRole: user.realRole ?? user.role,
    permissionKeys: user.permissionKeys ?? [],
  });
  if (!allowed) return null;
  return getProductionOrderHubView(input.flowId);
}
