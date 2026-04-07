import type { Metadata } from "next";
import { SettingsShell } from "../../../../components/settings/SettingsShell";
import { SettingsUsersManager } from "../../../../components/settings/SettingsUsersManager";
import { requirePermissionForPage, P } from "../../../../lib/authz/page-auth";

export const metadata: Metadata = {
  title: "Користувачі та ролі · ENVER CRM",
};

export default async function SettingsUsersPage() {
  await requirePermissionForPage(P.USERS_VIEW);

  return (
    <SettingsShell
      title="Користувачі та ролі"
      description="Керуйте користувачами команди, ролями та базовими правами доступу."
    >
      <SettingsUsersManager />
    </SettingsShell>
  );
}

