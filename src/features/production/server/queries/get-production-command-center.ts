import type { Session } from "next-auth";
import { getProductionCommandCenterView } from "../services/production-command-center.service";
import { canViewProduction } from "../permissions/production-permissions";

export async function getProductionCommandCenter(input: { session: Session }) {
  const user = input.session.user;
  if (
    !canViewProduction({
      dbRole: user.role,
      permissionKeys: user.permissionKeys ?? [],
      realRole: user.realRole ?? user.role,
    })
  ) {
    return null;
  }
  return getProductionCommandCenterView();
}
