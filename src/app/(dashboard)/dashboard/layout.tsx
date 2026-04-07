import type { ReactNode } from "react";
import { requirePermissionForPage } from "../../../lib/authz/page-auth";
import { P } from "../../../lib/authz/permissions";

/**
 * Лише маршрути під `/dashboard/*` (не весь CRM shell).
 */
export default async function DashboardSectionLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePermissionForPage(P.DASHBOARD_VIEW);
  return <>{children}</>;
}
