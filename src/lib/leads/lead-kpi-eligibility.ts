/** Хто бачить KPI-смугу в модулі лідів (нагляд лінії продажів). */
export function canViewLeadsKpiStrip(realRole: string): boolean {
  return (
    realRole === "HEAD_MANAGER" ||
    realRole === "MANAGER" ||
    realRole === "DIRECTOR" ||
    realRole === "ADMIN" ||
    realRole === "SUPER_ADMIN"
  );
}
