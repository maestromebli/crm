import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ExecutiveDashboardView } from "../../../../features/crm-dashboard/ExecutiveDashboardView";
import { getExecutiveDashboardPerms } from "../../../../features/dashboard/queries";
import { loadExecutiveDashboard } from "../../../../features/crm-dashboard/load-executive-dashboard";
import {
  applySavedViewDefaults,
  parseExecutiveDashboardQuery,
} from "../../../../features/crm-dashboard/executive-query";
import { getSessionAccess } from "../../../../lib/authz/session-access";

export const metadata: Metadata = {
  title: "Дашборд CRM — ENVER",
};

export default async function CrmDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await getSessionAccess();
  if (!access) redirect("/login");

  const sp = await searchParams;
  const query = applySavedViewDefaults(parseExecutiveDashboardQuery(sp));
  const perms = getExecutiveDashboardPerms(access);
  const data = await loadExecutiveDashboard(
    access,
    perms,
    access.role,
    query,
  );

  return (
    <ExecutiveDashboardView role={access.role} perms={perms} data={data} />
  );
}
