import type { Metadata } from "next";
import { SettingsShell } from "../../../../components/settings/SettingsShell";
import { NotificationsSettingsClient } from "./NotificationsSettingsClient";

export const metadata: Metadata = {
  title: "Правила сповіщень · ENVER CRM",
};

export default function SettingsNotificationsPage() {
  return (
    <SettingsShell
      title="Правила сповіщень"
      description="Налаштуйте, які події створюють сповіщення для команди."
    >
      <NotificationsSettingsClient />
    </SettingsShell>
  );
}
