import { isAdminLikeScope } from "../authz/permissions";

/** Хто бачить KPI-смугу в модулі лідів (нагляд лінії продажів). */
export function canViewLeadsKpiStrip(realRole: string): boolean {
  if (isAdminLikeScope({ realRole, dbRole: realRole })) return true;
  return (
    realRole === "HEAD_MANAGER" ||
    realRole === "MANAGER"
  );
}
