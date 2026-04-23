import type { Metadata } from "next";
import { SettingsShell } from "../../../../../components/settings/SettingsShell";
import { P, requirePermissionForPage } from "../../../../../lib/authz/page-auth";
import { CommunicationsHealthClient } from "./CommunicationsHealthClient";

export const metadata: Metadata = {
  title: "Стан каналів · ENVER CRM",
};

export default async function SettingsCommunicationsHealthPage() {
  await requirePermissionForPage(P.SETTINGS_VIEW);
  return (
    <SettingsShell
      title="Стан каналів звʼязку"
      description="Моніторинг вебхуків, вхідних/вихідних подій і помилок та швидка перевірка конфігурації по співробітнику."
    >
      <CommunicationsHealthClient />
    </SettingsShell>
  );
}
