import { getServerSession } from "next-auth";
import { authOptions } from "../auth/options";
import type { SessionUser } from "../authz/api-guard";
import { normalizeRole } from "../authz/roles";
import { buildFinanceCapabilityMap } from "../../features/finance/lib/permissions";
import { buildProcurementCapabilityMap } from "../../features/procurement/lib/permissions";

export type CrmModuleAccess = {
  user: SessionUser | null;
  finance: ReturnType<typeof buildFinanceCapabilityMap> | null;
  procurement: ReturnType<typeof buildProcurementCapabilityMap> | null;
};

/**
 * Доступ до дій модулів CRM за сесією (server components / server actions).
 */
export async function getCrmModuleAccess(): Promise<CrmModuleAccess> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { user: null, finance: null, procurement: null };
  }

  const user: SessionUser = {
    id: session.user.id,
    role: normalizeRole(session.user.role),
    dbRole: session.user.role,
    permissionKeys: session.user.permissionKeys ?? [],
    realRole: session.user.realRole ?? session.user.role,
    impersonatorId: session.user.impersonatorId,
  };

  return {
    user,
    finance: buildFinanceCapabilityMap(user),
    procurement: buildProcurementCapabilityMap(user),
  };
}
