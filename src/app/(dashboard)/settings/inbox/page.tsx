import type { Metadata } from "next";
import { SettingsShell } from "../../../../components/settings/SettingsShell";
import { InboxSettingsClient } from "./InboxSettingsClient";

export const metadata: Metadata = {
  title: "Вхідні / Telegram · ENVER CRM",
};

export default function SettingsInboxPage() {
  return (
    <SettingsShell
      title="Вхідні / Telegram"
      description="Підключіть Telegram та задайте правила роботи inbox."
    >
      <InboxSettingsClient />
    </SettingsShell>
  );
}

