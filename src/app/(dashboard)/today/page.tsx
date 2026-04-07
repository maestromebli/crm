import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TodayWorkspace } from "../../../components/today/TodayWorkspace";
import { AiV2InsightCard } from "../../../features/ai-v2";
import {
  hasEffectivePermission,
  P,
} from "../../../lib/authz/permissions";
import { getSessionAccess } from "../../../lib/authz/session-access";

export const metadata: Metadata = {
  title: "Мій день · ENVER CRM",
};

export default async function TodayPage() {
  const access = await getSessionAccess();
  if (!access) redirect("/login");
  if (
    !hasEffectivePermission(access.permissionKeys, P.TASKS_VIEW, {
      realRole: access.realRole,
      impersonatorId: access.impersonatorId,
    })
  ) {
    redirect("/crm/dashboard");
  }
  return (
    <div className="space-y-3">
      <AiV2InsightCard context="dashboard" />
      <TodayWorkspace />
    </div>
  );
}
