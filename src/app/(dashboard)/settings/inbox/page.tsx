import type { Metadata } from "next";
import { SettingsShell } from "../../../../components/settings/SettingsShell";
import { InboxSettingsClient } from "./InboxSettingsClient";
import { P, requirePermissionForPage } from "../../../../lib/authz/page-auth";

export const metadata: Metadata = {
  title: "Вхідні / Telegram · ENVER CRM",
};

export default async function SettingsInboxPage() {
  await requirePermissionForPage(P.NOTIFICATIONS_VIEW);
  return (
    <SettingsShell
      title="Вхідні / Telegram"
      description="Підключіть Telegram та задайте правила роботи inbox."
    >
      <InboxSettingsClient />
    </SettingsShell>
  );
}

