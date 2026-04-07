import type { Metadata } from "next";
import { SettingsShell } from "../../../../components/settings/SettingsShell";
import { CommunicationsSettingsClient } from "./CommunicationsSettingsClient";

export const metadata: Metadata = {
  title: "Месенджери та телефонія · ENVER CRM",
};

export default function SettingsCommunicationsPage() {
  return (
    <SettingsShell
      title="Месенджери та телефонія"
      description="Телефон менеджера для клієнтів і API каналів звʼязку: Telegram, WhatsApp, Viber, Instagram, Facebook, SMS та телефонія. Дані зберігаються в базі; секрети не показуються після збереження."
    >
      <CommunicationsSettingsClient />
    </SettingsShell>
  );
}
