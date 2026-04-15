import type { Metadata } from "next";
import { SettingsShell } from "../../../../../components/settings/SettingsShell";
import { AdminAiAdvisorChat } from "../../../../../components/settings/AdminAiAdvisorChat";

export const metadata: Metadata = {
  title: "AI-архітектор CRM · ENVER CRM",
};

export default function SettingsAiAdminPage() {
  return (
    <SettingsShell
      title="AI-архітектор CRM (адмін)"
      description="Постійний чат з AI для системних покращень CRM: процеси, автоматизації, промпти та план розвитку."
    >
      <AdminAiAdvisorChat />
    </SettingsShell>
  );
}
