import type { Metadata } from "next";
import { SettingsShell } from "../../../../../components/settings/SettingsShell";
import { AdminAiAdvisorChat } from "../../../../../components/settings/AdminAiAdvisorChat";
import { P, requirePermissionForPage } from "../../../../../lib/authz/page-auth";

export const metadata: Metadata = {
  title: "AI-архітектор CRM · ENVER CRM",
};

export default async function SettingsAiAdminPage() {
  await requirePermissionForPage(P.AI_ANALYTICS);

  return (
    <SettingsShell
      title="AI-архітектор CRM (адмін)"
      description="Постійний чат з AI для системних покращень CRM: процеси, автоматизації, промпти та план розвитку."
    >
      <AdminAiAdvisorChat />
    </SettingsShell>
  );
}
