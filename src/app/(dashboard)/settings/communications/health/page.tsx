import type { Metadata } from "next";
import { SettingsShell } from "../../../../../components/settings/SettingsShell";
import { P, requirePermissionForPage } from "../../../../../lib/authz/page-auth";
import { CommunicationsHealthClient } from "./CommunicationsHealthClient";

export const metadata: Metadata = {
  title: "Health каналів · ENVER CRM",
};

export default async function SettingsCommunicationsHealthPage() {
  await requirePermissionForPage(P.SETTINGS_VIEW);
  return (
    <SettingsShell
      title="Health каналів звʼязку"
      description="Моніторинг webhook/inbound/outbound/error та швидка перевірка конфігурації по співробітнику."
    >
      <CommunicationsHealthClient />
    </SettingsShell>
  );
}
