import type { ReactNode } from "react";
import { requirePermissionForPage } from "../../../../lib/authz/page-auth";
import { P } from "../../../../lib/authz/permissions";

export default async function CrmDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePermissionForPage(P.DASHBOARD_VIEW);
  return <>{children}</>;
}
