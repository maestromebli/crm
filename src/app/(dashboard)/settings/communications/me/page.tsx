import type { Metadata } from "next";
import { SettingsShell } from "../../../../../components/settings/SettingsShell";
import { CommunicationsSettingsClient } from "../CommunicationsSettingsClient";

export const metadata: Metadata = {
  title: "Мої канали звʼязку · ENVER CRM",
};

export default function SettingsMyCommunicationsPage() {
  return (
    <SettingsShell
      title="Мої канали звʼязку"
      description="Персональне підключення номера телефону та месенджерів для конкретного співробітника. Ці налаштування використовуються як пріоритетні для ваших лідів."
    >
      <CommunicationsSettingsClient
        apiBasePath="/api/settings/communications/me"
        managerCardTitle="Мої контакти"
        managerCardDescription="Ваш особистий номер і підпис для комунікації з клієнтами."
        saveHint="Персональні секрети зберігаються для вашого облікового запису і мають пріоритет над загальними налаштуваннями."
      />
    </SettingsShell>
  );
}
