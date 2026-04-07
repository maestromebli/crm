import type { ReactNode } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { requireSessionForAppLayout } from "@/lib/authz/page-auth";

/**
 * Єдиний операційний каркас для внутрішніх CRM-хабів (фінанси, закупівлі, виробництво…),
 * щоб URL `/crm/*` не відкривався «голим» контентом без бічного меню та шапки.
 */
export default async function CrmHubLayout({ children }: { children: ReactNode }) {
  await requireSessionForAppLayout();
  return <DashboardShell>{children}</DashboardShell>;
}
